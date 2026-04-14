"use strict";
figma.showUI(__html__, { width: 460, height: 760 });
function postAnalysis(text) {
    figma.ui.postMessage({ type: "analysis-result", text: text });
}
function postScopeReview(items, summary) {
    figma.ui.postMessage({
        type: "scope-review-result",
        items: items,
        summary: summary
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
function collectAliasesFromValue(value, output) {
    if (isAliasLike(value)) {
        output.push(value.id);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(function (item) {
            collectAliasesFromValue(item, output);
        });
        return;
    }
    if (typeof value === "object" && value !== null) {
        for (const nestedValue of Object.values(value)) {
            collectAliasesFromValue(nestedValue, output);
        }
    }
}
function collectNodeVariableIds(node) {
    const nodeWithBindings = node;
    const ids = [];
    if (!nodeWithBindings.boundVariables) {
        return ids;
    }
    for (const value of Object.values(nodeWithBindings.boundVariables)) {
        collectAliasesFromValue(value, ids);
    }
    return ids;
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
function inferScopesFromName(variable) {
    const name = variable.name.toLowerCase();
    if (name.includes("border-radius") || name.includes("radius"))
        return ["CORNER_RADIUS"];
    if (name.includes("min-height") ||
        name.includes("min-width") ||
        name.includes("/width/") ||
        name.includes("/height/")) {
        return ["WIDTH_HEIGHT"];
    }
    if (name.includes("gap") ||
        name.includes("horizontal") ||
        name.includes("vertical") ||
        name.includes("left") ||
        name.includes("right") ||
        name.includes("top") ||
        name.includes("bottom") ||
        name.includes("spacing")) {
        return ["GAP"];
    }
    if (name.includes("font-family"))
        return ["FONT_FAMILY"];
    if (name.includes("font-size"))
        return ["FONT_SIZE"];
    if (name.includes("font-weight"))
        return ["FONT_WEIGHT"];
    if (name.includes("letter-spacing"))
        return ["LETTER_SPACING"];
    if (name.includes("line-height"))
        return ["LINE_HEIGHT"];
    if (name.includes("opacity"))
        return ["OPACITY"];
    if (name.includes("box-shadow") || name.includes("shadow")) {
        return variable.resolvedType === "COLOR" ? ["EFFECT_COLOR"] : ["EFFECT_FLOAT"];
    }
    if (variable.resolvedType === "COLOR") {
        if (name.includes("/bg/"))
            return ["FRAME_FILL"];
        if (name.includes("/text/"))
            return ["TEXT_FILL"];
        if (name.includes("/border/") || name.includes("/line/"))
            return ["STROKE_COLOR"];
        if (name.includes("/trigger/") ||
            name.includes("/icon/") ||
            name.includes("/content/") ||
            name.includes("/thumb/")) {
            return ["SHAPE_FILL"];
        }
    }
    return ["ALL_SCOPES"];
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
    const items = [];
    for (const variableId of uniqueVariableIds) {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable || variable.remote)
            continue;
        const allowedScopes = getAllowedScopesByType(variable.resolvedType);
        const suggestedScopes = inferScopesFromName(variable).filter(function (scope) {
            return allowedScopes.includes(scope);
        });
        const currentScopes = variable.scopes.filter(function (scope) {
            return allowedScopes.includes(scope);
        });
        const selectedScopes = suggestedScopes.length > 0
            ? suggestedScopes.slice(0, 2)
            : currentScopes.length > 0
                ? currentScopes.slice(0, 2)
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
            isScopeMatched: isScopeMatched
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
    const cleanedScopes = Array.from(new Set(scopes.filter(Boolean))).slice(0, 2);
    variable.scopes = cleanedScopes;
}
figma.ui.onmessage = async function (msg) {
    if (msg.type === "run-check") {
        switch (msg.action) {
            case "broken-tokens":
                postAnalysis("Раздел «Проверить битые токены» пока заглушка.");
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
    if (msg.type === "apply-scope") {
        try {
            const appliedScopes = Array.from(new Set(msg.scopes.filter(Boolean))).slice(0, 2);
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
                const appliedScopes = Array.from(new Set(update.scopes.filter(Boolean))).slice(0, 2);
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
    }
};
