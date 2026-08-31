"use strict";
figma.showUI(__html__, { width: 460, height: 760 });
function postAnalysis(text) {
    figma.ui.postMessage({ type: "analysis-result", text: text });
}
function postBrokenTokensResult(result) {
    figma.ui.postMessage({
        type: "broken-tokens-result",
        summary: result.summary,
        details: result.details,
        paths: result.paths
    });
}
function postApplyTokenReview(result) {
    figma.ui.postMessage({
        type: "apply-token-review-result",
        summary: result.summary,
        groups: result.groups
    });
}
function postScopeReview(items, summary) {
    figma.ui.postMessage({
        type: "scope-review-result",
        items: items,
        summary: summary
    });
}
function postScopeFixResult(result) {
    figma.ui.postMessage({
        type: "scope-fix-result",
        summary: result.summary,
        changes: result.changes,
        needsReview: result.needsReview
    });
}
function postApplyResult(text, payload) {
    const message = {
        type: "apply-result",
        text: text
    };
    if (payload && payload.variableId) {
        message.variableId = payload.variableId;
    }
    if (payload && payload.scopes) {
        message.scopes = payload.scopes;
    }
    if (payload && payload.updates) {
        message.updates = payload.updates;
    }
    figma.ui.postMessage(message);
}
function postApplyTokenResult(text, payload) {
    figma.ui.postMessage({
        type: "apply-token-result",
        text: text,
        itemId: payload && payload.itemId ? payload.itemId : undefined
    });
}
function postApplyAllTokensResult(text, payload) {
    figma.ui.postMessage({
        type: "apply-all-tokens-result",
        text: text,
        groupIds: payload && payload.groupIds ? payload.groupIds : undefined
    });
}
function getSelectedRoots() {
    return Array.from(figma.currentPage.selection);
}
function getSelectedNodesAndDescendants() {
    const roots = getSelectedRoots();
    const allNodes = [];
    for (const root of roots) {
        allNodes.push(root);
        if ("findAll" in root) {
            allNodes.push(...root.findAll());
        }
    }
    return allNodes;
}
function isAliasLike(value) {
    return (typeof value === "object" &&
        value !== null &&
        "type" in value &&
        "id" in value &&
        value.type === "VARIABLE_ALIAS");
}
function formatBindingPath(path, segment) {
    if (!path) {
        return segment;
    }
    if (segment.startsWith("[")) {
        return path + segment;
    }
    return path + "." + segment;
}
function collectAliasesFromValue(value, output, path) {
    if (isAliasLike(value)) {
        output.push({
            variableId: value.id,
            propertyPath: path || "unknown"
        });
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(function (item, index) {
            collectAliasesFromValue(item, output, formatBindingPath(path, "[" + index + "]"));
        });
        return;
    }
    if (typeof value === "object" && value !== null) {
        for (const [key, nestedValue] of Object.entries(value)) {
            collectAliasesFromValue(nestedValue, output, formatBindingPath(path, key));
        }
    }
}
function collectReferencesFromBindings(bindings, output, prefix = "") {
    if (!bindings) {
        return;
    }
    for (const [key, value] of Object.entries(bindings)) {
        collectAliasesFromValue(value, output, formatBindingPath(prefix, key));
    }
}
function collectNodeVariableReferences(node) {
    const nodeWithBindings = node;
    const nodeWithPaints = node;
    const references = [];
    collectReferencesFromBindings(nodeWithBindings.boundVariables, references);
    if (Array.isArray(nodeWithPaints.fills)) {
        nodeWithPaints.fills.forEach(function (paint, index) {
            collectReferencesFromBindings(paint.boundVariables, references, "fills[" + index + "]");
            if ("gradientStops" in paint && Array.isArray(paint.gradientStops)) {
                paint.gradientStops.forEach(function (stop, stopIndex) {
                    collectReferencesFromBindings(stop.boundVariables, references, "fills[" + index + "].gradientStops[" + stopIndex + "]");
                });
            }
        });
    }
    if (Array.isArray(nodeWithPaints.strokes)) {
        nodeWithPaints.strokes.forEach(function (paint, index) {
            collectReferencesFromBindings(paint.boundVariables, references, "strokes[" + index + "]");
            if ("gradientStops" in paint && Array.isArray(paint.gradientStops)) {
                paint.gradientStops.forEach(function (stop, stopIndex) {
                    collectReferencesFromBindings(stop.boundVariables, references, "strokes[" + index + "].gradientStops[" + stopIndex + "]");
                });
            }
        });
    }
    if (Array.isArray(nodeWithPaints.effects)) {
        nodeWithPaints.effects.forEach(function (effect, index) {
            collectReferencesFromBindings(effect.boundVariables, references, "effects[" + index + "]");
        });
    }
    if (node.type === "TEXT") {
        const textSegments = node.getStyledTextSegments(["boundVariables"]);
        textSegments.forEach(function (segment) {
            collectReferencesFromBindings(segment.boundVariables, references, "textRange[" + segment.start + "-" + segment.end + "]");
        });
    }
    return references;
}
function collectNodeVariableIds(node) {
    return collectNodeVariableReferences(node).map(function (reference) {
        return reference.variableId;
    });
}
function normalizePathSegment(segment) {
    return segment.trim().replace(/\s+/g, "-").toLowerCase();
}
function getNodePathWithinRoot(root, node) {
    const parts = [];
    let current = node;
    while (current && current !== root) {
        if ("name" in current && typeof current.name === "string") {
            parts.unshift(normalizePathSegment(current.name));
        }
        current = current.parent;
    }
    parts.unshift(":" + normalizePathSegment(root.name));
    return parts.join("/");
}
function getReadablePropertyName(propertyPath) {
    const rootProperty = propertyPath.split(".")[0];
    if (rootProperty.startsWith("fills["))
        return "fill";
    if (rootProperty.startsWith("strokes["))
        return "stroke";
    if (rootProperty.startsWith("effects["))
        return "effect";
    if (rootProperty === "textRangeFills")
        return "text-fill";
    if (rootProperty.startsWith("textRange[")) {
        if (propertyPath.includes(".fills"))
            return "text-fill";
        if (propertyPath.includes(".fontSize"))
            return "font-size";
        if (propertyPath.includes(".fontFamily"))
            return "font-family";
        if (propertyPath.includes(".fontWeight"))
            return "font-weight";
        if (propertyPath.includes(".lineHeight"))
            return "line-height";
        if (propertyPath.includes(".letterSpacing"))
            return "letter-spacing";
        if (propertyPath.includes(".characters"))
            return "text";
        return "text-range";
    }
    switch (rootProperty) {
        case "itemSpacing":
        case "counterAxisSpacing":
            return "gap";
        case "paddingLeft":
            return "padding-left";
        case "paddingRight":
            return "padding-right";
        case "paddingTop":
            return "padding-top";
        case "paddingBottom":
            return "padding-bottom";
        case "cornerRadius":
            return "corner-radius";
        case "topLeftRadius":
            return "top-left-radius";
        case "topRightRadius":
            return "top-right-radius";
        case "bottomLeftRadius":
            return "bottom-left-radius";
        case "bottomRightRadius":
            return "bottom-right-radius";
        case "minWidth":
            return "min-width";
        case "maxWidth":
            return "max-width";
        case "minHeight":
            return "min-height";
        case "maxHeight":
            return "max-height";
        case "characters":
            return "text";
        default:
            return rootProperty.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    }
}
function normalizeSearchTokens(value) {
    return value
        .toLowerCase()
        .split(/[^a-z0-9а-яё]+/i)
        .filter(function (token) {
        return token.length > 1;
    });
}
function normalizeCollectionName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
}
function pluralizeToken(token) {
    if (!token) {
        return token;
    }
    if (token.endsWith("y") && token.length > 1) {
        return token.slice(0, -1) + "ies";
    }
    if (token.endsWith("s")) {
        return token;
    }
    return token + "s";
}
function hasExplicitOuterBox(root) {
    if (normalizePathSegment(root.name) === "outer-box") {
        return true;
    }
    if (!("findAll" in root)) {
        return false;
    }
    return root.findAll(function (node) {
        return normalizePathSegment(node.name) === "outer-box";
    }).length > 0;
}
function buildCanvasNameHints(root) {
    const normalized = root.name.toLowerCase();
    const parts = normalized.split("/").map(function (part) {
        return part.trim();
    }).filter(Boolean);
    const hints = new Set();
    parts.forEach(function (part) {
        const tokens = normalizeSearchTokens(part);
        if (!tokens.length) {
            return;
        }
        hints.add(tokens.join("-"));
        hints.add(tokens.map(pluralizeToken).join("-"));
        if (tokens.length > 1) {
            hints.add(pluralizeToken(tokens[0]));
            hints.add(pluralizeToken(tokens[0]) + "/" + tokens.join("-"));
            hints.add(pluralizeToken(tokens[0]) + "/" + tokens.slice(1).join("-"));
            hints.add(pluralizeToken(tokens[0]) + "/" + tokens.map(pluralizeToken).join("-"));
        }
        else {
            hints.add(pluralizeToken(tokens[0]));
        }
    });
    if (!hasExplicitOuterBox(root)) {
        hints.add("outer-box");
    }
    return Array.from(hints);
}
function getScopeHintsForProperty(node, propertyLabel, valueType) {
    if (valueType === "COLOR") {
        if (propertyLabel === "text-fill")
            return ["TEXT_FILL"];
        if (propertyLabel === "stroke")
            return ["STROKE_COLOR"];
        if (propertyLabel === "effect")
            return ["EFFECT_COLOR"];
        return ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"];
    }
    switch (propertyLabel) {
        case "gap":
        case "padding-left":
        case "padding-right":
        case "padding-top":
        case "padding-bottom":
            return ["GAP"];
        case "width":
        case "height":
        case "min-width":
        case "max-width":
        case "min-height":
        case "max-height":
            return ["WIDTH_HEIGHT"];
        case "corner-radius":
        case "top-left-radius":
        case "top-right-radius":
        case "bottom-left-radius":
        case "bottom-right-radius":
            return ["CORNER_RADIUS"];
        case "stroke-weight":
            return ["STROKE_FLOAT"];
        case "font-size":
            return ["FONT_SIZE"];
        case "font-weight":
            return ["FONT_WEIGHT"];
        case "line-height":
            return ["LINE_HEIGHT"];
        case "letter-spacing":
            return ["LETTER_SPACING"];
        case "font-family":
            return ["FONT_FAMILY"];
        case "text":
            return ["TEXT_CONTENT"];
        case "opacity":
            return ["OPACITY"];
        default:
            return ["ALL_SCOPES"];
    }
}
function scopesMatch(variable, desiredScopes) {
    if (!desiredScopes.length || desiredScopes.includes("ALL_SCOPES")) {
        return true;
    }
    if (variable.scopes.includes("ALL_SCOPES")) {
        return true;
    }
    return desiredScopes.some(function (scope) {
        return variable.scopes.includes(scope);
    });
}
function isColorValue(value) {
    return (typeof value === "object" &&
        value !== null &&
        "r" in value &&
        "g" in value &&
        "b" in value);
}
function colorDistance(left, right) {
    const alphaLeft = "a" in left && typeof left.a === "number" ? left.a : 1;
    const alphaRight = "a" in right && typeof right.a === "number" ? right.a : 1;
    return (Math.abs(left.r - right.r) +
        Math.abs(left.g - right.g) +
        Math.abs(left.b - right.b) +
        Math.abs(alphaLeft - alphaRight));
}
function scoreVariableValueMatch(variable, rawValue) {
    const valuesByMode = variable.valuesByMode || {};
    let bestScore = 0;
    for (const value of Object.values(valuesByMode)) {
        if (typeof rawValue === "number" && typeof value === "number") {
            if (rawValue === value) {
                bestScore = Math.max(bestScore, 70);
            }
            continue;
        }
        if (typeof rawValue === "string" && typeof value === "string") {
            if (rawValue === value) {
                bestScore = Math.max(bestScore, 70);
            }
            continue;
        }
        if (isColorValue(rawValue) && isColorValue(value)) {
            const distance = colorDistance(rawValue, value);
            if (distance < 0.001) {
                bestScore = Math.max(bestScore, 80);
            }
            else if (distance < 0.05) {
                bestScore = Math.max(bestScore, 40);
            }
        }
    }
    return bestScore;
}
function scoreVariableNameMatch(variableName, nodePath, propertyLabel, canvasHints) {
    const haystack = variableName.toLowerCase();
    const tokens = Array.from(new Set([
        ...normalizeSearchTokens(nodePath),
        ...normalizeSearchTokens(propertyLabel),
        ...canvasHints.flatMap(normalizeSearchTokens)
    ]));
    let score = 0;
    tokens.forEach(function (token) {
        if (haystack.includes(token)) {
            score += token.length > 4 ? 12 : 6;
        }
    });
    canvasHints.forEach(function (hint) {
        if (haystack.includes(hint)) {
            score += 24;
        }
    });
    if (propertyLabel === "padding-left" || propertyLabel === "padding-right") {
        if (haystack.includes("horizontal")) {
            score += 28;
        }
        if (propertyLabel === "padding-left" && haystack.includes("left")) {
            score += 20;
        }
        if (propertyLabel === "padding-right" && haystack.includes("right")) {
            score += 20;
        }
    }
    if (propertyLabel === "padding-top" || propertyLabel === "padding-bottom") {
        if (haystack.includes("vertical")) {
            score += 28;
        }
        if (propertyLabel === "padding-top" && haystack.includes("top")) {
            score += 20;
        }
        if (propertyLabel === "padding-bottom" && haystack.includes("bottom")) {
            score += 20;
        }
    }
    return score;
}
function hasMeaningfulNameMatch(variableName, nodePath, propertyLabel, canvasHints) {
    const haystack = variableName.toLowerCase();
    const tokens = Array.from(new Set([
        ...normalizeSearchTokens(nodePath),
        ...normalizeSearchTokens(propertyLabel),
        ...canvasHints.flatMap(normalizeSearchTokens)
    ])).filter(function (token) {
        return ![
            "true",
            "false",
            "default",
            "state",
            "size",
            "mode",
            "variant",
            "component",
            "inner",
            "outer",
            "box",
            "content"
        ].includes(token);
    });
    return canvasHints.some(function (hint) {
        return haystack.includes(hint);
    }) || tokens.some(function (token) {
        return haystack.includes(token);
    });
}
function formatRawValue(rawValue) {
    if (typeof rawValue === "number") {
        return String(rawValue);
    }
    if (typeof rawValue === "string") {
        return rawValue;
    }
    const alpha = "a" in rawValue && typeof rawValue.a === "number" ? rawValue.a : 1;
    return ("rgba(" +
        Math.round(rawValue.r * 255) + ", " +
        Math.round(rawValue.g * 255) + ", " +
        Math.round(rawValue.b * 255) + ", " +
        alpha.toFixed(2) +
        ")");
}
function getTopTokenCandidates(variables, valueType, desiredScopes, nodePath, propertyLabel, rawValue, canvasHints) {
    return variables
        .filter(function (variable) {
        return variable.resolvedType === valueType && scopesMatch(variable, desiredScopes);
    })
        .map(function (variable) {
        const valueScore = scoreVariableValueMatch(variable, rawValue);
        const nameScore = scoreVariableNameMatch(variable.name, nodePath, propertyLabel, canvasHints);
        const hasNameMatch = hasMeaningfulNameMatch(variable.name, nodePath, propertyLabel, canvasHints);
        const totalScore = valueScore + nameScore;
        return {
            id: variable.id,
            name: variable.name,
            reason: (desiredScopes.length ? desiredScopes.join(", ") : "ALL_SCOPES") +
                (valueScore > 0 ? " / value match" : "") +
                (nameScore > 0 ? " / name match" : ""),
            score: totalScore,
            hasNameMatch: hasNameMatch
        };
    })
        .filter(function (candidate) {
        return candidate.score > 0 && candidate.hasNameMatch;
    })
        .sort(function (a, b) {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.name.localeCompare(b.name);
    })
        .slice(0, 12)
        .map(function (candidate) {
        return {
            id: candidate.id,
            name: candidate.name,
            reason: candidate.reason
        };
    });
}
function buildApplyTokenItem(params) {
    const nodePath = getNodePathWithinRoot(params.root, params.node);
    const canvasHints = buildCanvasNameHints(params.root);
    const desiredScopes = getScopeHintsForProperty(params.node, params.propertyLabel, params.valueType);
    const candidates = getTopTokenCandidates(params.variables, params.valueType, desiredScopes, nodePath, params.propertyLabel, params.rawValue, canvasHints);
    return {
        itemId: params.itemId,
        nodeId: params.node.id,
        nodePath: nodePath,
        propertyLabel: params.propertyLabel,
        rawValueText: formatRawValue(params.rawValue),
        valueType: params.valueType,
        candidates: candidates,
        selectedVariableId: candidates[0] ? candidates[0].id : "",
        target: params.target,
        isResolved: candidates.length > 0
    };
}
function buildApplyTokenGroups(items) {
    const groups = new Map();
    items.forEach(function (item) {
        const normalizedPropertyLabel = item.propertyLabel === "top-left-radius" ||
            item.propertyLabel === "top-right-radius" ||
            item.propertyLabel === "bottom-left-radius" ||
            item.propertyLabel === "bottom-right-radius"
            ? "corner-radius"
            : item.propertyLabel;
        const candidateKey = item.candidates.map(function (candidate) {
            return candidate.id;
        }).slice(0, 5).join("|");
        const groupKey = [
            normalizedPropertyLabel,
            item.rawValueText,
            item.valueType,
            candidateKey
        ].join("::");
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                groupId: "group-" + groups.size,
                propertyLabel: normalizedPropertyLabel,
                rawValueText: item.rawValueText,
                valueType: item.valueType,
                candidates: item.candidates,
                selectedVariableId: item.selectedVariableId,
                members: [],
                previewPaths: [],
                isResolved: item.candidates.length === 0
            });
        }
        const group = groups.get(groupKey);
        group.members.push({
            itemId: item.itemId,
            nodeId: item.nodeId,
            nodePath: item.nodePath,
            propertyLabel: item.propertyLabel,
            target: item.target
        });
        if (group.previewPaths.length < 3) {
            group.previewPaths.push(item.nodePath + " / " + item.propertyLabel);
        }
    });
    return Array.from(groups.values()).sort(function (a, b) {
        const byProperty = a.propertyLabel.localeCompare(b.propertyLabel);
        if (byProperty !== 0) {
            return byProperty;
        }
        return a.rawValueText.localeCompare(b.rawValueText);
    });
}
function isBoundToNodeField(node, field) {
    const boundVariables = node.boundVariables;
    if (!boundVariables) {
        return false;
    }
    if (field === "strokeWeight") {
        return !!(boundVariables.strokeWeight ||
            boundVariables.strokeTopWeight ||
            boundVariables.strokeRightWeight ||
            boundVariables.strokeBottomWeight ||
            boundVariables.strokeLeftWeight);
    }
    return !!boundVariables[field];
}
function hasVisibleStroke(node) {
    const nodeWithStrokes = node;
    if (!Array.isArray(nodeWithStrokes.strokes) || nodeWithStrokes.strokes.length === 0) {
        return false;
    }
    const hasVisibleStrokePaint = nodeWithStrokes.strokes.some(function (paint) {
        if (!(paint.visible !== false)) {
            return false;
        }
        if ("opacity" in paint && typeof paint.opacity === "number" && paint.opacity <= 0) {
            return false;
        }
        return true;
    });
    if (!hasVisibleStrokePaint) {
        return false;
    }
    if (typeof nodeWithStrokes.strokeWeight === "number" && nodeWithStrokes.strokeWeight <= 0) {
        return false;
    }
    return true;
}
function collectApplyTokenItemsForNode(node, root, variables, output) {
    const nodeAny = node;
    const numericFields = [
        { field: "itemSpacing", label: "gap", value: nodeAny.itemSpacing },
        { field: "counterAxisSpacing", label: "counter-axis-gap", value: nodeAny.counterAxisSpacing },
        { field: "paddingLeft", label: "padding-left", value: nodeAny.paddingLeft },
        { field: "paddingRight", label: "padding-right", value: nodeAny.paddingRight },
        { field: "paddingTop", label: "padding-top", value: nodeAny.paddingTop },
        { field: "paddingBottom", label: "padding-bottom", value: nodeAny.paddingBottom },
        { field: "minWidth", label: "min-width", value: nodeAny.minWidth },
        { field: "maxWidth", label: "max-width", value: nodeAny.maxWidth },
        { field: "minHeight", label: "min-height", value: nodeAny.minHeight },
        { field: "maxHeight", label: "max-height", value: nodeAny.maxHeight },
        { field: "topLeftRadius", label: "top-left-radius", value: nodeAny.topLeftRadius },
        { field: "topRightRadius", label: "top-right-radius", value: nodeAny.topRightRadius },
        { field: "bottomLeftRadius", label: "bottom-left-radius", value: nodeAny.bottomLeftRadius },
        { field: "bottomRightRadius", label: "bottom-right-radius", value: nodeAny.bottomRightRadius },
        { field: "strokeWeight", label: "stroke-weight", value: nodeAny.strokeWeight }
    ];
    numericFields.forEach(function (entry) {
        if (entry.field === "strokeWeight" && !hasVisibleStroke(node)) {
            return;
        }
        if (typeof entry.value !== "number" || entry.value === 0 || isBoundToNodeField(node, entry.field)) {
            return;
        }
        output.push(buildApplyTokenItem({
            itemId: node.id + "::" + entry.field,
            node: node,
            root: root,
            propertyLabel: entry.label,
            valueType: "FLOAT",
            rawValue: entry.value,
            target: {
                kind: "node-field",
                field: entry.field
            },
            variables: variables
        }));
    });
    if (typeof nodeAny.opacity === "number" && nodeAny.opacity > 0 && nodeAny.opacity !== 1 && !isBoundToNodeField(node, "opacity")) {
        output.push(buildApplyTokenItem({
            itemId: node.id + "::opacity",
            node: node,
            root: root,
            propertyLabel: "opacity",
            valueType: "FLOAT",
            rawValue: nodeAny.opacity,
            target: {
                kind: "node-field",
                field: "opacity"
            },
            variables: variables
        }));
    }
    const containers = [
        { name: "fills", paints: nodeAny.fills },
        { name: "strokes", paints: nodeAny.strokes }
    ];
    containers.forEach(function (container) {
        if (!Array.isArray(container.paints)) {
            return;
        }
        container.paints.forEach(function (paint, index) {
            if (paint.type !== "SOLID") {
                return;
            }
            const isVisible = paint.visible !== false;
            const opacity = typeof paint.opacity === "number" ? paint.opacity : 1;
            const hasBoundColor = !!(paint.boundVariables && paint.boundVariables.color);
            if (!isVisible || opacity <= 0 || hasBoundColor) {
                return;
            }
            output.push(buildApplyTokenItem({
                itemId: node.id + "::" + container.name + "[" + index + "].color",
                node: node,
                root: root,
                propertyLabel: container.name === "fills" ? (node.type === "TEXT" ? "text-fill" : "fill") : "stroke",
                valueType: "COLOR",
                rawValue: {
                    r: paint.color.r,
                    g: paint.color.g,
                    b: paint.color.b,
                    a: opacity
                },
                target: {
                    kind: "paint-color",
                    container: container.name,
                    paintIndex: index
                },
                variables: variables
            }));
        });
    });
}
async function buildApplyTokenReview() {
    const selectedRoots = getSelectedRoots();
    if (!selectedRoots.length) {
        return {
            summary: "Ничего не выбрано.\n\nВыбери один или несколько слоев в Figma и нажми «Найти значения без токенов».",
            groups: []
        };
    }
    const localVariables = (await figma.variables.getLocalVariablesAsync()).filter(function (variable) {
        return !variable.remote;
    });
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionsById = new Map();
    localCollections.forEach(function (collection) {
        collectionsById.set(collection.id, collection.name || "");
    });
    const pageCollectionName = normalizeCollectionName(figma.currentPage.name);
    const pageVariables = localVariables.filter(function (variable) {
        const collectionName = collectionsById.get(variable.variableCollectionId) || "";
        return normalizeCollectionName(collectionName) === pageCollectionName;
    });
    const candidateVariables = pageVariables.length ? pageVariables : localVariables;
    const items = [];
    for (const root of selectedRoots) {
        const nodes = [root];
        if ("findAll" in root) {
            nodes.push(...root.findAll());
        }
        nodes.forEach(function (node) {
            collectApplyTokenItemsForNode(node, root, candidateVariables, items);
        });
    }
    if (!items.length) {
        return {
            summary: "На выбранном объекте не найдено значений без токенов.",
            groups: []
        };
    }
    const groups = buildApplyTokenGroups(items);
    const selectedNames = selectedRoots.map(function (node) {
        return node.name;
    }).join(", ");
    const withCandidates = groups.filter(function (group) {
        return group.candidates.length > 0;
    }).length;
    return {
        summary: "Проверил значения без токенов в объекте(объектах) " + selectedNames + "\n\n" +
            "Найдено значений без токенов: " + items.length + "\n" +
            "Групп похожих кейсов: " + groups.length + "\n" +
            "Есть подходящие токены: " + withCandidates,
        groups: groups
    };
}
async function applyTokenToTarget(nodeId, variableId, target) {
    const node = await figma.getNodeByIdAsync(nodeId);
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!node || !("type" in node)) {
        throw new Error("Node not found");
    }
    if (!variable) {
        throw new Error("Variable not found");
    }
    if (target.kind === "node-field") {
        node.setBoundVariable(target.field, variable);
        return;
    }
    const sceneNode = node;
    const paints = target.container === "fills" ? sceneNode.fills : sceneNode.strokes;
    if (!Array.isArray(paints)) {
        throw new Error("Paints not available");
    }
    const currentPaint = paints[target.paintIndex];
    if (!currentPaint || currentPaint.type !== "SOLID") {
        throw new Error("Solid paint not found");
    }
    const updatedPaint = figma.variables.setBoundVariableForPaint(currentPaint, "color", variable);
    const nextPaints = paints.slice();
    nextPaints[target.paintIndex] = updatedPaint;
    if (target.container === "fills") {
        sceneNode.fills = nextPaints;
    }
    else {
        sceneNode.strokes = nextPaints;
    }
}
async function buildBrokenTokensReport() {
    const selectedRoots = getSelectedRoots();
    if (!selectedRoots.length) {
        return {
            summary: "Ничего не выбрано.\n\nВыбери один или несколько слоев в Figma и нажми «Найти битые токены».",
            details: [],
            paths: []
        };
    }
    const references = [];
    for (const root of selectedRoots) {
        const nodes = [root];
        if ("findAll" in root) {
            nodes.push(...root.findAll());
        }
        for (const node of nodes) {
            const nodePath = getNodePathWithinRoot(root, node);
            const nodeReferences = collectNodeVariableReferences(node);
            nodeReferences.forEach(function (reference) {
                references.push({
                    path: nodePath + "/" + getReadablePropertyName(reference.propertyPath),
                    variableId: reference.variableId
                });
            });
        }
    }
    const uniqueVariableIds = Array.from(new Set(references.map(function (reference) {
        return reference.variableId;
    })));
    if (!uniqueVariableIds.length) {
        return {
            summary: "Выберите объект с токенами.",
            details: [],
            paths: []
        };
    }
    const allLocalVariables = await figma.variables.getLocalVariablesAsync();
    const localVariableIds = new Set(allLocalVariables.map(function (variable) {
        return variable.id;
    }));
    const trulyBrokenIds = new Set();
    const brokenDetails = new Map();
    for (const variableId of uniqueVariableIds) {
        try {
            const variable = await figma.variables.getVariableByIdAsync(variableId);
            const runtimeVariable = variable;
            if (!runtimeVariable) {
                trulyBrokenIds.add(variableId);
                brokenDetails.set(variableId, "Переменная не найдена");
                continue;
            }
            if (runtimeVariable.remote === false && !localVariableIds.has(variableId)) {
                trulyBrokenIds.add(variableId);
                brokenDetails.set(variableId, "\"" + (runtimeVariable.name || variableId) + "\" (локальная переменная удалена)");
                continue;
            }
            let collectionName = "Unknown";
            try {
                const collection = await figma.variables.getVariableCollectionByIdAsync(runtimeVariable.variableCollectionId || "");
                if (!collection) {
                    trulyBrokenIds.add(variableId);
                    brokenDetails.set(variableId, "\"" + (runtimeVariable.name || variableId) + "\" (коллекция удалена)");
                    continue;
                }
                const runtimeCollection = collection;
                collectionName = runtimeCollection.name || "Unknown";
            }
            catch (error) {
                trulyBrokenIds.add(variableId);
                brokenDetails.set(variableId, "\"" + (runtimeVariable.name || variableId) + "\" (коллекция недоступна)");
                continue;
            }
            if (runtimeVariable.remote === true && !runtimeVariable.key) {
                trulyBrokenIds.add(variableId);
                brokenDetails.set(variableId, "\"" + (runtimeVariable.name || variableId) + "\" (библиотека отключена)");
                continue;
            }
            let hasBrokenAlias = false;
            const valuesByMode = runtimeVariable.valuesByMode || {};
            for (const value of Object.values(valuesByMode)) {
                if (!isAliasLike(value)) {
                    continue;
                }
                try {
                    const aliasedVariable = await figma.variables.getVariableByIdAsync(value.id);
                    if (!aliasedVariable) {
                        hasBrokenAlias = true;
                        break;
                    }
                }
                catch (error) {
                    hasBrokenAlias = true;
                    break;
                }
            }
            if (hasBrokenAlias) {
                trulyBrokenIds.add(variableId);
                brokenDetails.set(variableId, "\"" + (runtimeVariable.name || variableId) + "\" из \"" + collectionName + "\" (разорванный алиас)");
            }
        }
        catch (error) {
            trulyBrokenIds.add(variableId);
            brokenDetails.set(variableId, "Ошибка доступа: " + (error instanceof Error ? error.message : "Unknown error"));
        }
    }
    const brokenReferences = Array.from(new Map(references
        .filter(function (reference) {
        return trulyBrokenIds.has(reference.variableId);
    })
        .map(function (reference) {
        return [reference.path + "::" + reference.variableId, reference];
    })).values()).sort(function (a, b) {
        return a.path.localeCompare(b.path);
    });
    const selectedNames = selectedRoots.map(function (node) {
        return node.name;
    }).join(", ");
    const checkedObjectsText = "Проверил битые токены в объекте(объектах) " + selectedNames;
    if (!brokenReferences.length) {
        return {
            summary: checkedObjectsText + "\n\n" +
                "Проверено bindings: " + references.length + "\n" +
                "Битых токенов не найдено.",
            details: [],
            paths: []
        };
    }
    const paths = brokenReferences.map(function (reference, index) {
        return (index + 1) + ". " + reference.path;
    });
    const detailLines = Array.from(trulyBrokenIds).map(function (variableId) {
        return brokenDetails.get(variableId) || variableId;
    });
    return {
        summary: checkedObjectsText + "\n\n" +
            "Проверено bindings: " + references.length + "\n" +
            "Найдено битых токенов: " + brokenReferences.length,
        details: detailLines,
        paths: paths
    };
}
function getAllowedScopesByType(type) {
    switch (type) {
        case "COLOR":
            return ["ALL_SCOPES", "FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR", "EFFECT_COLOR"];
        case "FLOAT":
            return [
                "ALL_SCOPES",
                "GAP",
                "WIDTH_HEIGHT",
                "CORNER_RADIUS",
                "STROKE_FLOAT",
                "FONT_SIZE",
                "FONT_WEIGHT",
                "LINE_HEIGHT",
                "LETTER_SPACING",
                "OPACITY",
                "EFFECT_FLOAT"
            ];
        case "STRING":
            return ["ALL_SCOPES", "FONT_FAMILY", "TEXT_CONTENT"];
        case "BOOLEAN":
            return ["ALL_SCOPES"];
        default:
            return ["ALL_SCOPES"];
    }
}
// "high" = matches a naming pattern that is unambiguous in >=90% of real tokens.
// "low" = the keyword exists but real usage is genuinely mixed (e.g. "trigger" is only
// 55% one scope combo, "indicator" splits three ways) — worth suggesting, not worth
// auto-applying without a human look.
const FLOAT_SCOPE_RULES = [
    { match: (s) => s.indexOf("radius") !== -1, scopes: ["CORNER_RADIUS"], confidence: "high" },
    { match: (s) => s === "border-width", scopes: ["STROKE_FLOAT"], confidence: "high" },
    { match: (s) => s === "font-family", scopes: ["FONT_FAMILY"], confidence: "high" },
    { match: (s) => s === "font-size", scopes: ["FONT_SIZE"], confidence: "high" },
    { match: (s) => s === "font-weight", scopes: ["FONT_WEIGHT"], confidence: "high" },
    { match: (s) => s === "line-height", scopes: ["LINE_HEIGHT"], confidence: "high" },
    { match: (s) => s === "letter-spacing", scopes: ["LETTER_SPACING"], confidence: "high" },
    { match: (s) => s === "opacity", scopes: ["OPACITY"], confidence: "high" },
    {
        match: (s) => s === "horizontal" || s === "vertical" || s === "gap" || s === "spacing",
        scopes: ["GAP"],
        confidence: "high"
    },
    {
        match: (s) => s === "width" ||
            s === "height" ||
            s === "sizing" ||
            s === "min-width" ||
            s === "max-width" ||
            s === "min-height" ||
            s === "max-height",
        scopes: ["WIDTH_HEIGHT"],
        confidence: "high"
    }
];
const STRING_SCOPE_RULES = [
    { match: (s) => s === "font-family", scopes: ["FONT_FAMILY"], confidence: "high" }
];
// Checked first, as exact segment matches only (avoids e.g. "button-text" or
// "text-input" component-name segments being mistaken for a "text" layer).
const COLOR_SCOPE_RULES_EXACT = [
    { match: (s) => s === "title" || s === "subtitle" || s === "text", scopes: ["TEXT_FILL"], confidence: "high" },
    { match: (s) => s === "border", scopes: ["STROKE_COLOR"], confidence: "high" },
    {
        match: (s) => s === "track" || s === "selector",
        scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
        confidence: "high"
    },
    { match: (s) => s === "bg" || s === "thumb", scopes: ["FRAME_FILL", "SHAPE_FILL"], confidence: "high" },
    { match: (s) => s === "content", scopes: ["SHAPE_FILL", "TEXT_FILL"], confidence: "high" },
    { match: (s) => s === "icon" || s === "chevron", scopes: ["SHAPE_FILL"], confidence: "high" },
    {
        match: (s) => s === "trigger" || s === "indicator",
        scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
        confidence: "low"
    },
    { match: (s) => s === "separator", scopes: ["SHAPE_FILL", "STROKE_COLOR"], confidence: "low" }
];
// Fallback pass, only run when nothing matched exactly: catches compound segments like
// "start-icon"/"end-icon" (contain "icon") or "validation-text" (contains "text").
const COLOR_SCOPE_RULES_CONTAINS = [
    { match: (s) => s.indexOf("icon") !== -1, scopes: ["SHAPE_FILL"], confidence: "high" },
    { match: (s) => s.indexOf("text") !== -1, scopes: ["TEXT_FILL"], confidence: "high" },
    { match: (s) => s.indexOf("border") !== -1, scopes: ["STROKE_COLOR"], confidence: "high" }
];
function getVariableNameSegments(name) {
    return name
        .toLowerCase()
        .split("/")
        .map(function (segment) {
        return segment.trim();
    })
        .filter(Boolean);
}
function findScopeFromSegments(segments, rules) {
    for (let i = segments.length - 1; i >= 0; i--) {
        for (const rule of rules) {
            if (rule.match(segments[i])) {
                return { scopes: rule.scopes, confidence: rule.confidence };
            }
        }
    }
    return null;
}
function suggestScopesFromName(variable) {
    const segments = getVariableNameSegments(variable.name);
    const leaf = segments[segments.length - 1];
    if (segments.indexOf("box-shadow") !== -1) {
        if (leaf === "x" || leaf === "y" || leaf === "blur" || leaf === "spread") {
            return { scopes: ["EFFECT_FLOAT"], confidence: "high" };
        }
        if (leaf === "color") {
            return { scopes: ["EFFECT_COLOR"], confidence: "high" };
        }
        if (leaf === "composite") {
            return { scopes: ["ALL_SCOPES"], confidence: "high" };
        }
    }
    // Icon/chevron's own size token is real-world scoped ALL_SCOPES, not WIDTH_HEIGHT —
    // unlike "layout/.../size" tokens, which are WIDTH_HEIGHT.
    if (leaf === "size" && (segments.indexOf("icon") !== -1 || segments.indexOf("chevron") !== -1)) {
        return { scopes: ["ALL_SCOPES"], confidence: "high" };
    }
    if (variable.resolvedType === "FLOAT") {
        return findScopeFromSegments(segments, FLOAT_SCOPE_RULES) || { scopes: ["ALL_SCOPES"], confidence: "low" };
    }
    if (variable.resolvedType === "STRING") {
        return findScopeFromSegments(segments, STRING_SCOPE_RULES) || { scopes: ["ALL_SCOPES"], confidence: "low" };
    }
    if (variable.resolvedType === "COLOR") {
        return (findScopeFromSegments(segments, COLOR_SCOPE_RULES_EXACT) ||
            findScopeFromSegments(segments, COLOR_SCOPE_RULES_CONTAINS) || { scopes: ["ALL_SCOPES"], confidence: "low" });
    }
    return { scopes: ["ALL_SCOPES"], confidence: "low" };
}
function sameScopes(a, b) {
    if (a.length !== b.length)
        return false;
    const left = a.slice().sort();
    const right = b.slice().sort();
    return left.every(function (value, index) {
        return value === right[index];
    });
}
async function buildScopeReview() {
    const selectedRoots = getSelectedRoots();
    if (!selectedRoots.length) {
        return {
            items: [],
            summary: "Ничего не выбрано.\n\nВыбери один или несколько слоев в Figma и нажми «Проверить scope»."
        };
    }
    const nodes = getSelectedNodesAndDescendants();
    const allVariableIds = nodes.flatMap(collectNodeVariableIds);
    const uniqueVariableIds = Array.from(new Set(allVariableIds));
    if (!uniqueVariableIds.length) {
        return {
            items: [],
            summary: "Выберите объект с токенами."
        };
    }
    const items = [];
    for (const variableId of uniqueVariableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable || variable.remote)
            continue;
        const allowedScopes = getAllowedScopesByType(variable.resolvedType);
        const suggestion = suggestScopesFromName(variable);
        const suggestedScopes = suggestion.scopes.filter(function (scope) {
            return allowedScopes.includes(scope);
        });
        const currentScopes = variable.scopes.filter(function (scope) {
            return allowedScopes.includes(scope);
        });
        const selectedScopes = suggestedScopes.length > 0
            ? suggestedScopes.slice(0, 3)
            : currentScopes.length > 0
                ? currentScopes.slice(0, 3)
                : ["ALL_SCOPES"];
        const isScopeMatched = suggestedScopes.length > 0 ? sameScopes(currentScopes, suggestedScopes) : currentScopes.length > 0;
        items.push({
            variableId: variable.id,
            variableName: variable.name,
            currentScopesText: currentScopes.length ? currentScopes.join(", ") : "No scopes set",
            suggestedScopesText: suggestedScopes.length ? suggestedScopes.join(", ") : "No suggestion",
            suggestedScopes: suggestedScopes,
            selectedScopes: selectedScopes,
            allowedScopes: allowedScopes,
            isScopeMatched: isScopeMatched,
            confidence: suggestion.confidence
        });
    }
    const sortedItems = items.sort(function (a, b) {
        return a.variableName.localeCompare(b.variableName);
    });
    const matchedCount = sortedItems.filter(function (item) {
        return item.isScopeMatched;
    }).length;
    const needReviewCount = sortedItems.length - matchedCount;
    const selectedNames = selectedRoots.map(function (node) {
        return node.name;
    }).join(", ");
    const summary = "Выбрано объектов: " + selectedRoots.length + "\n" +
        selectedNames + "\n\n" +
        "Найдено уникальных токенов: " + sortedItems.length + "\n" +
        "Нужно проверить: " + needReviewCount + "\n" +
        (needReviewCount === 0
            ? "Все scope совпадают с предложенными scope."
            : "Совпадают с предложенными: " + matchedCount);
    return {
        items: sortedItems,
        summary: summary
    };
}
async function applyVariableScopes(variableId, scopes) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable) {
        throw new Error("Variable not found");
    }
    if (variable.remote) {
        throw new Error("Токен " + variable.name + " нельзя изменить из этого файла");
    }
    const cleanedScopes = Array.from(new Set(scopes.filter(Boolean)));
    variable.scopes = cleanedScopes;
}
async function buildAndApplyScopeFix() {
    const localVariables = (await figma.variables.getLocalVariablesAsync()).filter(function (variable) {
        return !variable.remote;
    });
    const changes = [];
    const needsReview = [];
    for (const variable of localVariables) {
        const allowedScopes = getAllowedScopesByType(variable.resolvedType);
        const suggestion = suggestScopesFromName(variable);
        const suggestedScopes = suggestion.scopes.filter(function (scope) {
            return allowedScopes.includes(scope);
        });
        const currentScopes = variable.scopes.filter(function (scope) {
            return allowedScopes.includes(scope);
        });
        if (!suggestedScopes.length || sameScopes(currentScopes, suggestedScopes)) {
            continue;
        }
        const currentScopesText = currentScopes.length ? currentScopes.join(", ") : "No scopes set";
        const suggestedScopesText = suggestedScopes.join(", ");
        if (suggestion.confidence === "high") {
            variable.scopes = suggestedScopes;
            changes.push({
                variableId: variable.id,
                variableName: variable.name,
                fromScopesText: currentScopesText,
                toScopesText: suggestedScopesText
            });
        }
        else {
            needsReview.push({
                variableId: variable.id,
                variableName: variable.name,
                currentScopesText: currentScopesText,
                suggestedScopesText: suggestedScopesText
            });
        }
    }
    const sortedChanges = changes.sort(function (a, b) {
        return a.variableName.localeCompare(b.variableName);
    });
    const sortedNeedsReview = needsReview.sort(function (a, b) {
        return a.variableName.localeCompare(b.variableName);
    });
    const summary = "Проверено локальных токенов: " + localVariables.length + "\n" +
        "Исправлено автоматически: " + sortedChanges.length + "\n" +
        "Требуют ручной проверки: " + sortedNeedsReview.length +
        (sortedChanges.length === 0 && sortedNeedsReview.length === 0
            ? "\n\nВсе scope уже соответствуют паттернам именования."
            : "");
    return {
        summary: summary,
        changes: sortedChanges,
        needsReview: sortedNeedsReview
    };
}
figma.ui.onmessage = async function (msg) {
    if (msg.type === "run-check") {
        switch (msg.action) {
            case "broken-tokens":
                postBrokenTokensResult(await buildBrokenTokensReport());
                return;
            case "assign-gap":
                postAnalysis("Раздел «Назначить gap» пока заглушка.");
                return;
            case "raw-values":
                postAnalysis("Раздел «Найти значения без токенов» пока заглушка.");
                return;
            case "unused-tokens":
                postAnalysis("Раздел «Найти неиспользуемые токены» пока заглушка.");
                return;
            default:
                postAnalysis("Неизвестное действие.");
                return;
        }
    }
    if (msg.type === "run-scope-review") {
        const result = await buildScopeReview();
        postScopeReview(result.items, result.summary);
        return;
    }
    if (msg.type === "run-fix-scope") {
        postScopeFixResult(await buildAndApplyScopeFix());
        return;
    }
    if (msg.type === "run-apply-token-review") {
        const result = await buildApplyTokenReview();
        postApplyTokenReview(result);
        return;
    }
    if (msg.type === "apply-scope") {
        try {
            const appliedScopes = Array.from(new Set(msg.scopes.filter(Boolean))).slice(0, 3);
            await applyVariableScopes(msg.variableId, appliedScopes);
            postApplyResult("Scope успешно применен.", {
                variableId: msg.variableId,
                scopes: appliedScopes
            });
        }
        catch (error) {
            postAnalysis("Не удалось применить scope: " + (error instanceof Error ? error.message : "Unknown error"));
        }
        return;
    }
    if (msg.type === "apply-all-scopes") {
        let successCount = 0;
        const errors = [];
        const updates = [];
        for (const update of msg.updates) {
            try {
                const appliedScopes = Array.from(new Set(update.scopes.filter(Boolean))).slice(0, 3);
                await applyVariableScopes(update.variableId, appliedScopes);
                updates.push({
                    variableId: update.variableId,
                    scopes: appliedScopes
                });
                successCount += 1;
            }
            catch (error) {
                errors.push(error instanceof Error ? error.message : "Unknown error");
            }
        }
        if (errors.length > 0) {
            postApplyResult("Применено: " + successCount + "\nОшибок: " + errors.length + "\n" + errors.join("\n"), { updates: updates });
        }
        else {
            postApplyResult("Готово. Применено scope: " + successCount, { updates: updates });
        }
        return;
    }
    if (msg.type === "apply-token") {
        try {
            await applyTokenToTarget(msg.nodeId, msg.variableId, msg.target);
            postApplyTokenResult("Токен успешно применен.", {
                itemId: msg.itemId
            });
        }
        catch (error) {
            postApplyTokenResult("Не удалось применить токен: " + (error instanceof Error ? error.message : "Unknown error"), {
                itemId: msg.itemId
            });
        }
        return;
    }
    if (msg.type === "apply-all-tokens") {
        let successCount = 0;
        const appliedGroupIds = [];
        const errors = [];
        for (const update of msg.updates) {
            try {
                await applyTokenToTarget(update.nodeId, update.variableId, update.target);
                successCount += 1;
            }
            catch (error) {
                errors.push(error instanceof Error ? error.message : "Unknown error");
            }
        }
        const groupIds = Array.from(new Set(msg.updates.map(function (update) {
            return update.groupId;
        })));
        appliedGroupIds.push(...groupIds);
        if (errors.length > 0) {
            postApplyAllTokensResult("Применено токенов: " + successCount + "\nОшибок: " + errors.length, { groupIds: appliedGroupIds });
        }
        else {
            postApplyAllTokensResult("Готово. Применено токенов: " + successCount, {
                groupIds: appliedGroupIds
            });
        }
    }
};
