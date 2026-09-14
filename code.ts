figma.showUI(__html__, { width: 460, height: 760 });

type PluginMessage =
  | { type: "run-check"; action: string }
  | { type: "run-scope-review" }
  | { type: "run-list-scope-fix-folders" }
  | { type: "run-fix-scope"; folderId?: string }
  | { type: "run-library-review" }
  | { type: "select-nodes"; nodeIds: string[] }
  | { type: "run-apply-token-review" }
  | { type: "apply-scope"; variableId: string; scopes: VariableScope[] }
  | { type: "apply-all-scopes"; updates: Array<{ variableId: string; scopes: VariableScope[] }> }
  | { type: "apply-token"; itemId: string; nodeId: string; variableId: string; target: ApplyTokenTarget }
  | { type: "apply-all-tokens"; updates: Array<{ groupId: string; itemId: string; nodeId: string; variableId: string; target: ApplyTokenTarget }> };

type VariableAliasLike = {
  type: "VARIABLE_ALIAS";
  id: string;
};

type VariableReference = {
  variableId: string;
  propertyPath: string;
};

type RuntimeVariableLike = {
  id: string;
  name?: string;
  variableCollectionId?: string;
  remote?: boolean;
  key?: string;
  valuesByMode?: Record<string, VariableValue>;
};

type RuntimeVariableCollectionLike = {
  id: string;
  name?: string;
  key?: string;
};

type ScopeReviewItem = {
  variableId: string;
  variableName: string;
  currentScopesText: string;
  suggestedScopesText: string;
  suggestedScopes: VariableScope[];
  selectedScopes: VariableScope[];
  allowedScopes: VariableScope[];
  isScopeMatched: boolean;
  confidence: "high" | "low";
  isLegacySizeStructure: boolean;
};

type ScopeFixChange = {
  variableId: string;
  variableName: string;
  fromScopesText: string;
  toScopesText: string;
  isLegacySizeStructure: boolean;
};

type ScopeFixReviewEntry = {
  variableId: string;
  variableName: string;
  currentScopesText: string;
  // The 2 individual scopes most likely to be right, ranked by how often each one
  // actually appears across the real candidate combinations for this role — shown as
  // quick-pick chips. "allowedScopes" is the full pickable set, shown behind "more...".
  quickScopes: VariableScope[];
  allowedScopes: VariableScope[];
  isLegacySizeStructure: boolean;
};

type ScopeFixResult = {
  summary: string;
  changes: ScopeFixChange[];
  needsReview: ScopeFixReviewEntry[];
};

type ScopeFixFolder = {
  folderId: string;
  label: string;
  count: number;
};

type LibraryUsageToken = {
  variableId: string;
  variableName: string;
  nodeIds: string[];
};

type LibraryUsageGroup = {
  groupId: string;
  libraryLabel: string;
  isLocal: boolean;
  tokens: LibraryUsageToken[];
};

type LibraryReviewResult = {
  summary: string;
  groups: LibraryUsageGroup[];
};

type BrokenTokenPath = {
  text: string;
  nodeId: string;
  variableName: string;
};

type BrokenTokensResult = {
  summary: string;
  details: string[];
  paths: BrokenTokenPath[];
};

type ApplyTokenTarget =
  | {
      kind: "node-field";
      field: VariableBindableNodeField | VariableBindableTextField;
    }
  | {
      kind: "paint-color";
      container: "fills" | "strokes";
      paintIndex: number;
    };

type TokenCandidate = {
  id: string;
  name: string;
  reason: string;
};

type ApplyTokenReviewItem = {
  itemId: string;
  nodeId: string;
  nodePath: string;
  propertyLabel: string;
  rawValueText: string;
  valueType: VariableResolvedDataType;
  candidates: TokenCandidate[];
  selectedVariableId: string;
  target: ApplyTokenTarget;
  isResolved: boolean;
};

type ApplyTokenGroupMember = {
  itemId: string;
  nodeId: string;
  nodePath: string;
  propertyLabel: string;
  target: ApplyTokenTarget;
};

type ApplyTokenReviewGroup = {
  groupId: string;
  propertyLabel: string;
  rawValueText: string;
  valueType: VariableResolvedDataType;
  candidates: TokenCandidate[];
  selectedVariableId: string;
  members: ApplyTokenGroupMember[];
  previewPaths: string[];
  isResolved: boolean;
};

type ApplyTokenReviewResult = {
  summary: string;
  groups: ApplyTokenReviewGroup[];
};

function postAnalysis(text: string) {
  figma.ui.postMessage({ type: "analysis-result", text: text });
}

function postBrokenTokensResult(result: BrokenTokensResult) {
  figma.ui.postMessage({
    type: "broken-tokens-result",
    summary: result.summary,
    details: result.details,
    paths: result.paths
  });
}

function postApplyTokenReview(result: ApplyTokenReviewResult) {
  figma.ui.postMessage({
    type: "apply-token-review-result",
    summary: result.summary,
    groups: result.groups
  });
}

function postScopeReview(items: ScopeReviewItem[], summary: string) {
  figma.ui.postMessage({
    type: "scope-review-result",
    items: items,
    summary: summary
  });
}

function postScopeFixResult(result: ScopeFixResult) {
  figma.ui.postMessage({
    type: "scope-fix-result",
    summary: result.summary,
    changes: result.changes,
    needsReview: result.needsReview
  });
}

function postScopeFixFolders(folders: ScopeFixFolder[]) {
  figma.ui.postMessage({
    type: "scope-fix-folders-result",
    folders: folders
  });
}

function postLibraryReview(result: LibraryReviewResult) {
  figma.ui.postMessage({
    type: "library-review-result",
    summary: result.summary,
    groups: result.groups
  });
}

function postSelectNodesResult(payload: { selectedCount: number; error?: string }) {
  figma.ui.postMessage({
    type: "select-nodes-result",
    selectedCount: payload.selectedCount,
    error: payload.error
  });
}

async function selectNodesByIds(nodeIds: string[]): Promise<{ selectedCount: number; error?: string }> {
  const nodes: SceneNode[] = [];

  for (const nodeId of nodeIds) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
        nodes.push(node as SceneNode);
      }
    } catch (error) {
      // Node no longer exists — skip it.
    }
  }

  if (!nodes.length) {
    return {
      selectedCount: 0,
      error: "Слои не найдены — возможно, они были удалены."
    };
  }

  try {
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
    return { selectedCount: nodes.length };
  } catch (error) {
    return {
      selectedCount: 0,
      error: "Не удалось выделить слои — возможно, они на другой странице."
    };
  }
}

function postApplyResult(
  text: string,
  payload?: {
    variableId?: string;
    scopes?: VariableScope[];
    updates?: Array<{ variableId: string; scopes: VariableScope[] }>;
  }
) {
  const message: {
    type: "apply-result";
    text: string;
    variableId?: string;
    scopes?: VariableScope[];
    updates?: Array<{ variableId: string; scopes: VariableScope[] }>;
  } = {
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

function postApplyTokenResult(text: string, payload?: { itemId?: string }) {
  figma.ui.postMessage({
    type: "apply-token-result",
    text: text,
    itemId: payload && payload.itemId ? payload.itemId : undefined
  });
}

function postApplyAllTokensResult(
  text: string,
  payload?: { groupIds?: string[] }
) {
  figma.ui.postMessage({
    type: "apply-all-tokens-result",
    text: text,
    groupIds: payload && payload.groupIds ? payload.groupIds : undefined
  });
}

function getSelectedRoots(): SceneNode[] {
  return Array.from(figma.currentPage.selection);
}

function getSelectedNodesAndDescendants(): SceneNode[] {
  const roots = getSelectedRoots();
  const allNodes: SceneNode[] = [];

  for (const root of roots) {
    allNodes.push(root);
    if ("findAll" in root) {
      allNodes.push(...root.findAll());
    }
  }

  return allNodes;
}

function isAliasLike(value: unknown): value is VariableAliasLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "id" in value &&
    (value as VariableAliasLike).type === "VARIABLE_ALIAS"
  );
}

function formatBindingPath(path: string, segment: string) {
  if (!path) {
    return segment;
  }

  if (segment.startsWith("[")) {
    return path + segment;
  }

  return path + "." + segment;
}

function collectAliasesFromValue(value: unknown, output: VariableReference[], path: string) {
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

function collectReferencesFromBindings(
  bindings: Record<string, unknown> | undefined,
  output: VariableReference[],
  prefix = ""
) {
  if (!bindings) {
    return;
  }

  for (const [key, value] of Object.entries(bindings)) {
    collectAliasesFromValue(value, output, formatBindingPath(prefix, key));
  }
}

function collectNodeVariableReferences(node: SceneNode): VariableReference[] {
  const nodeWithBindings = node as SceneNode & {
    boundVariables?: Record<string, unknown>;
  };
  const nodeWithPaints = node as SceneNode & {
    fills?: ReadonlyArray<Paint> | PluginAPI["mixed"];
    strokes?: ReadonlyArray<Paint>;
    effects?: ReadonlyArray<Effect>;
  };

  const references: VariableReference[] = [];

  collectReferencesFromBindings(nodeWithBindings.boundVariables, references);

  if (Array.isArray(nodeWithPaints.fills)) {
    nodeWithPaints.fills.forEach(function (paint, index) {
      collectReferencesFromBindings(
        paint.boundVariables as Record<string, unknown> | undefined,
        references,
        "fills[" + index + "]"
      );

      if ("gradientStops" in paint && Array.isArray(paint.gradientStops)) {
        paint.gradientStops.forEach(function (stop: ColorStop, stopIndex: number) {
          collectReferencesFromBindings(
            stop.boundVariables as Record<string, unknown> | undefined,
            references,
            "fills[" + index + "].gradientStops[" + stopIndex + "]"
          );
        });
      }
    });
  }

  if (Array.isArray(nodeWithPaints.strokes)) {
    nodeWithPaints.strokes.forEach(function (paint, index) {
      collectReferencesFromBindings(
        paint.boundVariables as Record<string, unknown> | undefined,
        references,
        "strokes[" + index + "]"
      );

      if ("gradientStops" in paint && Array.isArray(paint.gradientStops)) {
        paint.gradientStops.forEach(function (stop: ColorStop, stopIndex: number) {
          collectReferencesFromBindings(
            stop.boundVariables as Record<string, unknown> | undefined,
            references,
            "strokes[" + index + "].gradientStops[" + stopIndex + "]"
          );
        });
      }
    });
  }

  if (Array.isArray(nodeWithPaints.effects)) {
    nodeWithPaints.effects.forEach(function (effect, index) {
      collectReferencesFromBindings(
        effect.boundVariables as Record<string, unknown> | undefined,
        references,
        "effects[" + index + "]"
      );
    });
  }

  if (node.type === "TEXT") {
    const textSegments = node.getStyledTextSegments(["boundVariables"]);

    textSegments.forEach(function (segment) {
      collectReferencesFromBindings(
        segment.boundVariables as Record<string, unknown> | undefined,
        references,
        "textRange[" + segment.start + "-" + segment.end + "]"
      );
    });
  }

  return references;
}

function collectNodeVariableIds(node: SceneNode): string[] {
  return collectNodeVariableReferences(node).map(function (reference) {
    return reference.variableId;
  });
}

function normalizePathSegment(segment: string): string {
  return segment.trim().replace(/\s+/g, "-").toLowerCase();
}

function getNodePathWithinRoot(root: SceneNode, node: SceneNode): string {
  const parts: string[] = [];
  let current: BaseNode | null = node;

  while (current && current !== root) {
    if ("name" in current && typeof current.name === "string") {
      parts.unshift(normalizePathSegment(current.name));
    }
    current = current.parent;
  }

  parts.unshift(":" + normalizePathSegment(root.name));

  return parts.join("/");
}

function getReadablePropertyName(propertyPath: string): string {
  const rootProperty = propertyPath.split(".")[0];

  if (rootProperty.startsWith("fills[")) return "fill";
  if (rootProperty.startsWith("strokes[")) return "stroke";
  if (rootProperty.startsWith("effects[")) return "effect";
  if (rootProperty === "textRangeFills") return "text-fill";
  if (rootProperty.startsWith("textRange[")) {
    if (propertyPath.includes(".fills")) return "text-fill";
    if (propertyPath.includes(".fontSize")) return "font-size";
    if (propertyPath.includes(".fontFamily")) return "font-family";
    if (propertyPath.includes(".fontWeight")) return "font-weight";
    if (propertyPath.includes(".lineHeight")) return "line-height";
    if (propertyPath.includes(".letterSpacing")) return "letter-spacing";
    if (propertyPath.includes(".characters")) return "text";
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

function normalizeSearchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9а-яё]+/i)
    .filter(function (token) {
      return token.length > 1;
    });
}

function normalizeCollectionName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function pluralizeToken(token: string): string {
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

function hasExplicitOuterBox(root: SceneNode): boolean {
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

function buildCanvasNameHints(root: SceneNode): string[] {
  const normalized = root.name.toLowerCase();
  const parts = normalized.split("/").map(function (part) {
    return part.trim();
  }).filter(Boolean);

  const hints = new Set<string>();

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
    } else {
      hints.add(pluralizeToken(tokens[0]));
    }
  });

  if (!hasExplicitOuterBox(root)) {
    hints.add("outer-box");
  }

  return Array.from(hints);
}

function getScopeHintsForProperty(
  node: SceneNode,
  propertyLabel: string,
  valueType: VariableResolvedDataType
): VariableScope[] {
  if (valueType === "COLOR") {
    if (propertyLabel === "text-fill") return ["TEXT_FILL"];
    if (propertyLabel === "stroke") return ["STROKE_COLOR"];
    if (propertyLabel === "effect") return ["EFFECT_COLOR"];
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

function scopesMatch(variable: Variable, desiredScopes: VariableScope[]) {
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

function isColorValue(value: unknown): value is RGBA {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value
  );
}

function colorDistance(left: RGBA, right: RGBA) {
  const alphaLeft = "a" in left && typeof left.a === "number" ? left.a : 1;
  const alphaRight = "a" in right && typeof right.a === "number" ? right.a : 1;

  return (
    Math.abs(left.r - right.r) +
    Math.abs(left.g - right.g) +
    Math.abs(left.b - right.b) +
    Math.abs(alphaLeft - alphaRight)
  );
}

function scoreVariableValueMatch(variable: Variable, rawValue: number | string | RGBA) {
  const valuesByMode = (variable as RuntimeVariableLike).valuesByMode || {};
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
      } else if (distance < 0.05) {
        bestScore = Math.max(bestScore, 40);
      }
    }
  }

  return bestScore;
}

function scoreVariableNameMatch(variableName: string, nodePath: string, propertyLabel: string, canvasHints: string[]) {
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

function hasMeaningfulNameMatch(variableName: string, nodePath: string, propertyLabel: string, canvasHints: string[]) {
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

function formatRawValue(rawValue: number | string | RGBA) {
  if (typeof rawValue === "number") {
    return String(rawValue);
  }

  if (typeof rawValue === "string") {
    return rawValue;
  }

  const alpha = "a" in rawValue && typeof rawValue.a === "number" ? rawValue.a : 1;
  return (
    "rgba(" +
    Math.round(rawValue.r * 255) + ", " +
    Math.round(rawValue.g * 255) + ", " +
    Math.round(rawValue.b * 255) + ", " +
    alpha.toFixed(2) +
    ")"
  );
}

function getTopTokenCandidates(
  variables: Variable[],
  valueType: VariableResolvedDataType,
  desiredScopes: VariableScope[],
  nodePath: string,
  propertyLabel: string,
  rawValue: number | string | RGBA,
  canvasHints: string[]
): TokenCandidate[] {
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
        reason:
          (desiredScopes.length ? desiredScopes.join(", ") : "ALL_SCOPES") +
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

function buildApplyTokenItem(params: {
  itemId: string;
  node: SceneNode;
  root: SceneNode;
  propertyLabel: string;
  valueType: VariableResolvedDataType;
  rawValue: number | string | RGBA;
  target: ApplyTokenTarget;
  variables: Variable[];
}): ApplyTokenReviewItem {
  const nodePath = getNodePathWithinRoot(params.root, params.node);
  const canvasHints = buildCanvasNameHints(params.root);
  const desiredScopes = getScopeHintsForProperty(params.node, params.propertyLabel, params.valueType);
  const candidates = getTopTokenCandidates(
    params.variables,
    params.valueType,
    desiredScopes,
    nodePath,
    params.propertyLabel,
    params.rawValue,
    canvasHints
  );

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

function buildApplyTokenGroups(items: ApplyTokenReviewItem[]): ApplyTokenReviewGroup[] {
  const groups = new Map<string, ApplyTokenReviewGroup>();

  items.forEach(function (item) {
    const normalizedPropertyLabel =
      item.propertyLabel === "top-left-radius" ||
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

    const group = groups.get(groupKey)!;
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

function isBoundToNodeField(node: SceneNode, field: string) {
  const boundVariables = (node as SceneNode & { boundVariables?: Record<string, unknown> }).boundVariables;
  if (!boundVariables) {
    return false;
  }

  if (field === "strokeWeight") {
    return !!(
      boundVariables.strokeWeight ||
      boundVariables.strokeTopWeight ||
      boundVariables.strokeRightWeight ||
      boundVariables.strokeBottomWeight ||
      boundVariables.strokeLeftWeight
    );
  }

  return !!boundVariables[field];
}

function hasVisibleStroke(node: SceneNode): boolean {
  const nodeWithStrokes = node as SceneNode & {
    strokes?: ReadonlyArray<Paint>;
    strokeWeight?: number | PluginAPI["mixed"];
  };

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

function collectApplyTokenItemsForNode(
  node: SceneNode,
  root: SceneNode,
  variables: Variable[],
  output: ApplyTokenReviewItem[]
) {
  const nodeAny = node as SceneNode & {
    width?: number;
    height?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    itemSpacing?: number;
    counterAxisSpacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    topLeftRadius?: number;
    topRightRadius?: number;
    bottomLeftRadius?: number;
    bottomRightRadius?: number;
    strokeWeight?: number;
    opacity?: number;
    fills?: ReadonlyArray<Paint> | PluginAPI["mixed"];
    strokes?: ReadonlyArray<Paint>;
  };

  const numericFields: Array<{
    field: VariableBindableNodeField;
    label: string;
    value: unknown;
  }> = [
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

    output.push(
      buildApplyTokenItem({
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
      })
    );
  });

  if (typeof nodeAny.opacity === "number" && nodeAny.opacity > 0 && nodeAny.opacity !== 1 && !isBoundToNodeField(node, "opacity")) {
    output.push(
      buildApplyTokenItem({
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
      })
    );
  }

  const containers: Array<{ name: "fills" | "strokes"; paints: ReadonlyArray<Paint> | PluginAPI["mixed"] | undefined }> = [
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

      output.push(
        buildApplyTokenItem({
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
        })
      );
    });
  });
}

async function buildApplyTokenReview(): Promise<ApplyTokenReviewResult> {
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
  const collectionsById = new Map<string, string>();

  (localCollections as RuntimeVariableCollectionLike[]).forEach(function (collection) {
    collectionsById.set(collection.id, collection.name || "");
  });

  const pageCollectionName = normalizeCollectionName(figma.currentPage.name);
  const pageVariables = localVariables.filter(function (variable) {
    const collectionName = collectionsById.get(variable.variableCollectionId) || "";
    return normalizeCollectionName(collectionName) === pageCollectionName;
  });
  const candidateVariables = pageVariables.length ? pageVariables : localVariables;

  const items: ApplyTokenReviewItem[] = [];

  for (const root of selectedRoots) {
    const nodes: SceneNode[] = [root];

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
    summary:
      "Проверил значения без токенов в объекте(объектах) " + selectedNames + "\n\n" +
      "Найдено значений без токенов: " + items.length + "\n" +
      "Групп похожих кейсов: " + groups.length + "\n" +
      "Есть подходящие токены: " + withCandidates,
    groups: groups
  };
}

async function applyTokenToTarget(nodeId: string, variableId: string, target: ApplyTokenTarget) {
  const node = await figma.getNodeByIdAsync(nodeId);
  const variable = await figma.variables.getVariableByIdAsync(variableId);

  if (!node || !("type" in node)) {
    throw new Error("Node not found");
  }

  if (!variable) {
    throw new Error("Variable not found");
  }

  if (target.kind === "node-field") {
    (node as SceneNode).setBoundVariable(target.field, variable);
    return;
  }

  const sceneNode = node as SceneNode & {
    fills?: Paint[] | PluginAPI["mixed"];
    strokes?: Paint[];
  };
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
  } else {
    sceneNode.strokes = nextPaints;
  }
}

async function buildLibraryReview(): Promise<LibraryReviewResult> {
  const selectedRoots = getSelectedRoots();

  if (!selectedRoots.length) {
    return {
      summary: "Ничего не выбрано.\n\nВыбери один или несколько слоев в Figma и нажми «Проверить библиотеки».",
      groups: []
    };
  }

  const references: Array<{ nodeId: string; variableId: string }> = [];

  for (const root of selectedRoots) {
    const nodes: SceneNode[] = [root];

    if ("findAll" in root) {
      nodes.push(...root.findAll());
    }

    for (const node of nodes) {
      collectNodeVariableIds(node).forEach(function (variableId) {
        references.push({ nodeId: node.id, variableId: variableId });
      });
    }
  }

  const nodeIdsByVariableId = new Map<string, Set<string>>();

  references.forEach(function (reference) {
    const set = nodeIdsByVariableId.get(reference.variableId) || new Set<string>();
    set.add(reference.nodeId);
    nodeIdsByVariableId.set(reference.variableId, set);
  });

  const uniqueVariableIds = Array.from(nodeIdsByVariableId.keys());

  if (!uniqueVariableIds.length) {
    return {
      summary: "Выберите объект с токенами.",
      groups: []
    };
  }

  // Resolve remote collections to the library they were published from. This is only
  // a lookup table matched by collection.key — if it can't be loaded for any reason,
  // remote tokens still get grouped, just under a generic "external library" label
  // built from the collection's own name instead of the friendly library title.
  let libraryCollections: LibraryVariableCollection[] = [];
  try {
    libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  } catch (error) {
    libraryCollections = [];
  }

  const groupsByKey = new Map<string, LibraryUsageGroup>();
  let unresolvedCount = 0;
  // Figma only reveals a library's real name for libraries currently ENABLED in this
  // file (Assets → Team library) — that's a hard Plugin API limit, not something we can
  // work around. When a remote collection's library isn't enabled, its name is unknown
  // even though the token itself still resolves and works fine.
  let unresolvedLibraryCount = 0;

  for (const variableId of uniqueVariableIds) {
    const nodeIds = Array.from(nodeIdsByVariableId.get(variableId) || []);

    let variable: Variable | null = null;
    try {
      variable = await figma.variables.getVariableByIdAsync(variableId);
    } catch (error) {
      variable = null;
    }

    if (!variable) {
      unresolvedCount += 1;
      continue;
    }

    let groupKey = "local";
    let libraryLabel = "Локальные токены файла";
    const isLocal = !variable.remote;

    if (variable.remote) {
      let collectionName = "";
      let collectionKey = "";

      try {
        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
        if (collection) {
          collectionName = collection.name;
          collectionKey = collection.key;
        }
      } catch (error) {
        // Collection unreachable — fall back to the generic label below.
      }

      const matchedLibrary = libraryCollections.find(function (entry) {
        return collectionKey !== "" && entry.key === collectionKey;
      });

      if (matchedLibrary) {
        libraryLabel = matchedLibrary.libraryName;
        groupKey = "lib:" + matchedLibrary.libraryName;
      } else {
        unresolvedLibraryCount += 1;
        libraryLabel =
          "Библиотека не включена в файле" + (collectionName ? " (коллекция «" + collectionName + "»)" : "");
        groupKey = "lib-unresolved:" + (collectionName || "unknown");
      }
    }

    if (!groupsByKey.has(groupKey)) {
      groupsByKey.set(groupKey, {
        groupId: groupKey,
        libraryLabel: libraryLabel,
        isLocal: isLocal,
        tokens: []
      });
    }

    groupsByKey.get(groupKey)!.tokens.push({
      variableId: variable.id,
      variableName: variable.name,
      nodeIds: nodeIds
    });
  }

  const groups = Array.from(groupsByKey.values());

  groups.forEach(function (group) {
    group.tokens.sort(function (a, b) {
      return a.variableName.localeCompare(b.variableName);
    });
  });

  groups.sort(function (a, b) {
    if (a.isLocal !== b.isLocal) {
      return a.isLocal ? 1 : -1;
    }
    return a.libraryLabel.localeCompare(b.libraryLabel);
  });

  const selectedNames = selectedRoots.map(function (node) {
    return node.name;
  }).join(", ");
  const libraryCount = groups.filter(function (group) {
    return !group.isLocal;
  }).length;
  const localTokenCount = groups
    .filter(function (group) {
      return group.isLocal;
    })
    .reduce(function (sum, group) {
      return sum + group.tokens.length;
    }, 0);

  const summary =
    "Проверил библиотеки токенов в объекте(объектах) " + selectedNames + "\n\n" +
    "Найдено уникальных токенов: " + uniqueVariableIds.length + "\n" +
    "Библиотек: " + libraryCount + "\n" +
    "Локальных токенов: " + localTokenCount +
    (unresolvedCount > 0 ? "\nНе удалось определить: " + unresolvedCount : "") +
    (unresolvedLibraryCount > 0
      ? "\n\nДля " +
        unresolvedLibraryCount +
        " токен(ов) не удалось получить название библиотеки — убедись, что нужная библиотека включена в этом файле (Assets → Team library), и запусти проверку ещё раз."
      : "");

  return { summary: summary, groups: groups };
}

type AliasChainCheck = { broken: boolean; reason: string };

// figma.variables.getVariableByIdAsync happily returns a cached/stale object for a
// remote variable that was deleted from its source library — it does NOT throw. The
// only way to tell "this exact variable was removed from Foundation" from "this
// variable is fine, just in a library we don't currently have enabled" is to check the
// library's OWN published variable list by key. Memoized per collection since one
// collection (e.g. a theme-switcher) can be checked against by hundreds of tokens.
async function getLibraryVariableKeys(
  collectionKey: string,
  memo: Map<string, Promise<Set<string> | null>>
): Promise<Set<string> | null> {
  const cached = memo.get(collectionKey);
  if (cached) {
    return cached;
  }

  const promise = (async function (): Promise<Set<string> | null> {
    try {
      const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collectionKey);
      return new Set(libraryVariables.map(function (entry) {
        return entry.key;
      }));
    } catch (error) {
      // Can't reach this library right now (not enabled, no access, request failed) —
      // return null so the caller treats this as "unknown", not "deleted".
      return null;
    }
  })();

  memo.set(collectionKey, promise);
  return promise;
}

// Walks a variable's ENTIRE alias chain, not just one hop. A local token often aliases
// to a token in an intermediate library (e.g. a theme-switcher collection), which in
// turn aliases to a foundation/palette library. When the foundation library renames or
// deletes a token, the break happens at that deeper link — the intermediate variable
// still "exists" (its own id resolves fine), so a shallow one-hop check misses it
// entirely. This is exactly the "changed in Foundation, doesn't arrive locally"
// scenario: the alias silently dangles a hop or two down, invisible until a developer
// pulls the token and gets nothing.
async function checkVariableChain(
  variableId: string,
  localVariableIds: Set<string>,
  availableCollectionKeys: Set<string>,
  libraryVariableKeysMemo: Map<string, Promise<Set<string> | null>>,
  memo: Map<string, Promise<AliasChainCheck>>,
  visited: Set<string>,
  depth: number
): Promise<AliasChainCheck> {
  if (visited.has(variableId) || depth > 12) {
    // Cycle guard / runaway-depth backstop — not itself what we're detecting.
    return { broken: false, reason: "" };
  }

  const cached = memo.get(variableId);
  if (cached) {
    return cached;
  }

  const promise = (async function (): Promise<AliasChainCheck> {
    let variable: RuntimeVariableLike | null;

    try {
      variable = (await figma.variables.getVariableByIdAsync(variableId)) as RuntimeVariableLike | null;
    } catch (error) {
      return { broken: true, reason: "Переменная не найдена" };
    }

    if (!variable) {
      return { broken: true, reason: "Переменная не найдена" };
    }

    if (variable.remote === false && !localVariableIds.has(variableId)) {
      return {
        broken: true,
        reason: "\"" + (variable.name || variableId) + "\" (локальная переменная удалена)"
      };
    }

    let collectionName = "Unknown";
    let collectionKey = "";

    try {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId || "");

      if (!collection) {
        return {
          broken: true,
          reason: "\"" + (variable.name || variableId) + "\" (коллекция удалена)"
        };
      }

      const runtimeCollection = collection as RuntimeVariableCollectionLike;
      collectionName = runtimeCollection.name || "Unknown";
      collectionKey = runtimeCollection.key || "";
    } catch (error) {
      return {
        broken: true,
        reason: "\"" + (variable.name || variableId) + "\" (коллекция недоступна)"
      };
    }

    if (variable.remote === true) {
      if (!variable.key) {
        return {
          broken: true,
          reason: "\"" + (variable.name || variableId) + "\" (библиотека отключена)"
        };
      }

      // Only check per-variable presence for collections we can actually see — a
      // collection whose library isn't enabled here returns an EMPTY list (not an
      // error), which would otherwise look identical to "every variable was deleted".
      // Skipping it keeps this from re-flagging things like an unused alternate-brand
      // mode that simply isn't enabled in this file.
      if (collectionKey && availableCollectionKeys.has(collectionKey)) {
        const libraryVariableKeys = await getLibraryVariableKeys(collectionKey, libraryVariableKeysMemo);

        if (libraryVariableKeys && !libraryVariableKeys.has(variable.key)) {
          return {
            broken: true,
            reason:
              "\"" +
              (variable.name || variableId) +
              "\" из \"" +
              collectionName +
              "\" (удалён или переименован в библиотеке — обновление из Foundation не подтянуто сюда)"
          };
        }
      }
    }

    const nextVisited = new Set(visited);
    nextVisited.add(variableId);

    const valuesByMode = variable.valuesByMode || {};

    for (const value of Object.values(valuesByMode)) {
      if (!isAliasLike(value)) {
        continue;
      }

      const nested = await checkVariableChain(
        value.id,
        localVariableIds,
        availableCollectionKeys,
        libraryVariableKeysMemo,
        memo,
        nextVisited,
        depth + 1
      );

      if (nested.broken) {
        return {
          broken: true,
          reason:
            "\"" +
            (variable.name || variableId) +
            "\" из \"" +
            collectionName +
            "\" → цепочка алиасов ведёт к недоступному токену: " +
            nested.reason
        };
      }
    }

    return { broken: false, reason: "" };
  })();

  memo.set(variableId, promise);
  return promise;
}

async function buildBrokenTokensReport(): Promise<BrokenTokensResult> {
  const selectedRoots = getSelectedRoots();

  if (!selectedRoots.length) {
    return {
      summary: "Ничего не выбрано.\n\nВыбери один или несколько слоев в Figma и нажми «Найти битые токены».",
      details: [],
      paths: []
    };
  }

  const references: Array<{
    path: string;
    variableId: string;
    nodeId: string;
  }> = [];

  for (const root of selectedRoots) {
    const nodes: SceneNode[] = [root];

    if ("findAll" in root) {
      nodes.push(...root.findAll());
    }

    for (const node of nodes) {
      const nodePath = getNodePathWithinRoot(root, node);
      const nodeReferences = collectNodeVariableReferences(node);

      nodeReferences.forEach(function (reference) {
        references.push({
          path: nodePath + "/" + getReadablePropertyName(reference.propertyPath),
          variableId: reference.variableId,
          nodeId: node.id
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

  // Which library collections Figma can currently see for this file — gates the
  // per-variable deletion check below so an unrelated, simply-not-enabled library
  // (e.g. an unused alternate brand) never gets treated as "everything in it was
  // deleted". Left empty (check skipped everywhere) if the API call itself fails.
  let availableCollectionKeys = new Set<string>();
  try {
    const availableCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    availableCollectionKeys = new Set(availableCollections.map(function (entry) {
      return entry.key;
    }));
  } catch (error) {
    availableCollectionKeys = new Set<string>();
  }

  const trulyBrokenIds = new Set<string>();
  const brokenDetails = new Map<string, string>();

  const chainMemo = new Map<string, Promise<AliasChainCheck>>();
  const libraryVariableKeysMemo = new Map<string, Promise<Set<string> | null>>();

  for (const variableId of uniqueVariableIds) {
    const check = await checkVariableChain(
      variableId,
      localVariableIds,
      availableCollectionKeys,
      libraryVariableKeysMemo,
      chainMemo,
      new Set<string>(),
      0
    );

    if (check.broken) {
      trulyBrokenIds.add(variableId);
      brokenDetails.set(variableId, check.reason);
    }
  }

  const brokenReferences = Array.from(
    new Map(
      references
        .filter(function (reference) {
          return trulyBrokenIds.has(reference.variableId);
        })
        .map(function (reference) {
          return [reference.path + "::" + reference.variableId, reference] as const;
        })
    ).values()
  ).sort(function (a, b) {
    return a.path.localeCompare(b.path);
  });

  const selectedNames = selectedRoots.map(function (node) {
    return node.name;
  }).join(", ");
  const checkedObjectsText = "Проверил битые токены в объекте(объектах) " + selectedNames;

  if (!brokenReferences.length) {
    return {
      summary:
        checkedObjectsText + "\n\n" +
        "Проверено bindings: " + references.length + "\n" +
        "Битых токенов не найдено.",
      details: [],
      paths: []
    };
  }

  const brokenVariableNames = new Map<string, string>();

  for (const variableId of trulyBrokenIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      brokenVariableNames.set(variableId, variable ? variable.name : variableId);
    } catch (error) {
      brokenVariableNames.set(variableId, variableId);
    }
  }

  const paths: BrokenTokenPath[] = brokenReferences.map(function (reference, index) {
    return {
      text: (index + 1) + ". " + reference.path,
      nodeId: reference.nodeId,
      variableName: brokenVariableNames.get(reference.variableId) || ""
    };
  });

  const detailLines = Array.from(trulyBrokenIds).map(function (variableId) {
    return brokenDetails.get(variableId) || variableId;
  });

  return {
    summary:
      checkedObjectsText + "\n\n" +
      "Проверено bindings: " + references.length + "\n" +
      "Найдено битых токенов: " + brokenReferences.length,
    details: detailLines,
    paths: paths
  };
}

function getAllowedScopesByType(type: VariableResolvedDataType): VariableScope[] {
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

// The rules below were derived by statistically analyzing ~7300 real design tokens
// (tokens/components/**/*.json in the design-tokens repo, incl. the WPF component
// library) and their existing `$extensions["com.figma.scopes"]` values, grouped by
// the naming-convention "layer"/"parameter" segment documented in
// tokens/components/README.md. Matching walks name segments (split by "/") from the
// leaf backwards, so an earlier segment that happens to contain a role word (e.g. the
// mode segment in "button/color/text/primary/bg/rest", or the component name in
// "text-input/color/default/border/rest") never shadows the real layer segment closer
// to the leaf.
type ScopeConfidence = "high" | "low";

type ScopeSuggestion = {
  scopes: VariableScope[];
  confidence: ScopeConfidence;
  // For "low" confidence suggestions only: a few real candidate combinations (ranked
  // by how often they actually occur for this role) to offer as one-click picks instead
  // of a single guess, since the "right" answer genuinely varies per component.
  alternatives?: VariableScope[][];
};

type ScopeSegmentRule = {
  match: (segment: string) => boolean;
  scopes: VariableScope[];
  confidence: ScopeConfidence;
  alternatives?: VariableScope[][];
};

// The team prefers to never fall back to ALL_SCOPES as a *guess* — an unrecognized
// pattern should surface as "no suggestion" (leave the current scope alone) rather than
// push a maximally-permissive scope. The only confirmed real use of ALL_SCOPES is
// icon/chevron's own "size" token (handled as its own case below) and the composite
// box-shadow value (not a per-field bindable property).
const NO_SUGGESTION: ScopeSuggestion = { scopes: [], confidence: "low" };

// "high" = matches a naming pattern that is unambiguous in >=90% of real tokens.
// "low" = the keyword exists but real usage is genuinely mixed (e.g. "trigger" is only
// 55% one scope combo, "indicator" splits several ways) — worth suggesting a few ranked
// options, not worth auto-applying without a human look.
const FLOAT_SCOPE_RULES: ScopeSegmentRule[] = [
  { match: (s) => s.indexOf("radius") !== -1, scopes: ["CORNER_RADIUS"], confidence: "high" },
  { match: (s) => s === "border-width", scopes: ["STROKE_FLOAT"], confidence: "high" },
  { match: (s) => s === "font-family", scopes: ["FONT_FAMILY"], confidence: "high" },
  { match: (s) => s === "font-size", scopes: ["FONT_SIZE"], confidence: "high" },
  { match: (s) => s === "font-weight", scopes: ["FONT_WEIGHT"], confidence: "high" },
  { match: (s) => s === "line-height", scopes: ["LINE_HEIGHT"], confidence: "high" },
  { match: (s) => s === "letter-spacing", scopes: ["LETTER_SPACING"], confidence: "high" },
  { match: (s) => s === "opacity", scopes: ["OPACITY"], confidence: "high" },
  {
    // "horizontal"/"vertical" with any suffix (horizontal-start, horizontal-lw, vertical-end, …)
    // is still GAP.
    match: (s) => s.indexOf("horizontal") === 0 || s.indexOf("vertical") === 0 || s === "gap" || s === "spacing",
    scopes: ["GAP"],
    confidence: "high"
  },
  {
    match: (s) =>
      s === "width" ||
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

const STRING_SCOPE_RULES: ScopeSegmentRule[] = [
  { match: (s) => s === "font-family", scopes: ["FONT_FAMILY"], confidence: "high" }
];

// Checked first, as exact segment matches only (avoids e.g. "button-text" or
// "text-input" component-name segments being mistaken for a "text" layer).
const COLOR_SCOPE_RULES_EXACT: ScopeSegmentRule[] = [
  {
    match: (s) => s === "title" || s === "subtitle" || s === "text" || s === "description",
    scopes: ["TEXT_FILL"],
    confidence: "high"
  },
  { match: (s) => s === "border", scopes: ["STROKE_COLOR"], confidence: "high" },
  { match: (s) => s === "line", scopes: ["SHAPE_FILL", "STROKE_COLOR"], confidence: "high" },
  {
    match: (s) => s === "track" || s === "selector",
    scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
    confidence: "high"
  },
  { match: (s) => s === "bg" || s === "thumb", scopes: ["FRAME_FILL", "SHAPE_FILL"], confidence: "high" },
  { match: (s) => s === "content", scopes: ["SHAPE_FILL", "TEXT_FILL"], confidence: "high" },
  { match: (s) => s === "icon" || s === "chevron", scopes: ["SHAPE_FILL"], confidence: "high" },
  {
    match: (s) => s === "trigger",
    scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
    confidence: "low",
    alternatives: [["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"], ["SHAPE_FILL"], ["FRAME_FILL"]]
  },
  {
    match: (s) => s === "indicator",
    scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
    confidence: "low",
    alternatives: [
      ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
      ["FRAME_FILL", "SHAPE_FILL"],
      ["SHAPE_FILL", "TEXT_FILL"],
      ["TEXT_FILL"]
    ]
  },
  {
    match: (s) => s === "separator",
    scopes: ["SHAPE_FILL", "STROKE_COLOR"],
    confidence: "low",
    alternatives: [
      ["SHAPE_FILL", "STROKE_COLOR"],
      ["SHAPE_FILL"],
      ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"],
      ["FRAME_FILL", "SHAPE_FILL"]
    ]
  }
];

// Fallback pass, only run when nothing matched exactly: catches compound segments like
// "start-icon"/"end-icon" (contain "icon") or "validation-text" (contains "text").
const COLOR_SCOPE_RULES_CONTAINS: ScopeSegmentRule[] = [
  { match: (s) => s.indexOf("icon") !== -1, scopes: ["SHAPE_FILL"], confidence: "high" },
  { match: (s) => s.indexOf("text") !== -1, scopes: ["TEXT_FILL"], confidence: "high" },
  { match: (s) => s.indexOf("border") !== -1, scopes: ["STROKE_COLOR"], confidence: "high" }
];

// Legacy WPF token names sometimes bake the size mode straight into the path
// ("…/medium", "…/small") instead of using the size collection/mode. The current
// convention keeps size out of the name entirely, so seeing one of these as its own
// segment means the token still uses the old per-component structure.
const LEGACY_SIZE_SEGMENTS = ["small", "medium", "large"];

function isLegacySizeStructure(segments: string[]): boolean {
  return segments.some(function (segment) {
    return LEGACY_SIZE_SEGMENTS.indexOf(segment) !== -1;
  });
}

// The team's own "folder" convention: a component's tokens live under the "Size" or
// "Theme" variable collection, and within that collection the token's own name starts
// with the component's name — e.g. collection "Theme" + variable
// "accordion/item-header/color/..." => folder "theme/accordion". Matched by substring
// so it still works whether the collection is literally named "Size"/"Theme" or
// something like "Sizing".
function classifyCollectionBucket(collectionName: string): "size" | "theme" | null {
  const normalized = collectionName.toLowerCase();
  if (normalized.indexOf("size") !== -1) return "size";
  if (normalized.indexOf("theme") !== -1) return "theme";
  return null;
}

async function getLocalCollectionNamesById(): Promise<Map<string, string>> {
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionsById = new Map<string, string>();

  localCollections.forEach(function (collection) {
    collectionsById.set(collection.id, collection.name);
  });

  return collectionsById;
}

// The folder is just the component name — a variable counts toward it as long as it
// lives in a "Size" or "Theme"-like collection (that's what tells us it's structured
// per-component at all); which of the two doesn't matter for the folder identity.
function getVariableFolderId(variable: Variable, collectionsById: Map<string, string>): string | null {
  const collectionName = collectionsById.get(variable.variableCollectionId) || "";
  const bucket = classifyCollectionBucket(collectionName);
  if (!bucket) return null;

  const segments = getVariableNameSegments(variable.name);
  const component = segments[0];
  if (!component) return null;

  return component;
}

async function listScopeFixFolders(): Promise<ScopeFixFolder[]> {
  const localVariables = (await figma.variables.getLocalVariablesAsync()).filter(function (variable) {
    return !variable.remote;
  });
  const collectionsById = await getLocalCollectionNamesById();

  const counts = new Map<string, number>();

  localVariables.forEach(function (variable) {
    const folderId = getVariableFolderId(variable, collectionsById);
    if (!folderId) return;

    counts.set(folderId, (counts.get(folderId) || 0) + 1);
  });

  const folders: ScopeFixFolder[] = Array.from(counts.entries()).map(function (entry) {
    return { folderId: entry[0], label: entry[0], count: entry[1] };
  });

  folders.sort(function (a, b) {
    return a.folderId.localeCompare(b.folderId);
  });

  return folders;
}

function getVariableNameSegments(name: string): string[] {
  return name
    .toLowerCase()
    .split("/")
    .map(function (segment) {
      return segment.trim();
    })
    .filter(Boolean);
}

function findScopeFromSegments(segments: string[], rules: ScopeSegmentRule[]): ScopeSuggestion | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    for (const rule of rules) {
      if (rule.match(segments[i])) {
        return { scopes: rule.scopes, confidence: rule.confidence, alternatives: rule.alternatives };
      }
    }
  }

  return null;
}

function suggestScopesFromName(variable: Variable): ScopeSuggestion {
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
  // unlike "layout/.../size" tokens, which are WIDTH_HEIGHT. This is the one confirmed
  // legitimate use of ALL_SCOPES as a suggestion.
  if (leaf === "size" && (segments.indexOf("icon") !== -1 || segments.indexOf("chevron") !== -1)) {
    return { scopes: ["ALL_SCOPES"], confidence: "high" };
  }

  if (variable.resolvedType === "FLOAT") {
    const found = findScopeFromSegments(segments, FLOAT_SCOPE_RULES);
    if (found) return found;

    // Focus-rect layout tokens ("offset", "outer-box", …) represent the ring's spacing,
    // not a literal box size — treat any of them as GAP.
    if (segments.indexOf("focus-rect") !== -1) {
      return { scopes: ["GAP"], confidence: "high" };
    }

    return NO_SUGGESTION;
  }

  if (variable.resolvedType === "STRING") {
    return findScopeFromSegments(segments, STRING_SCOPE_RULES) || NO_SUGGESTION;
  }

  if (variable.resolvedType === "COLOR") {
    return (
      findScopeFromSegments(segments, COLOR_SCOPE_RULES_EXACT) ||
      findScopeFromSegments(segments, COLOR_SCOPE_RULES_CONTAINS) ||
      NO_SUGGESTION
    );
  }

  return NO_SUGGESTION;
}

function sameScopes(a: VariableScope[], b: VariableScope[]) {
  if (a.length !== b.length) return false;

  const left = a.slice().sort();
  const right = b.slice().sort();

  return left.every(function (value, index) {
    return value === right[index];
  });
}

function isScopeUnset(scopes: VariableScope[]) {
  return scopes.length === 0 || (scopes.length === 1 && scopes[0] === "ALL_SCOPES");
}

// A variable's current scope can legitimately be *broader* than what its own name
// suggests — the same token is sometimes reused across several unrelated bindable
// properties (e.g. one shared "medium" spacing value bound to a gap, a corner-radius,
// and a width in different components). Narrowing that down based on name alone would
// break those other bindings, so treat "current already covers what we'd suggest" as
// fine, not a mismatch.
function isCurrentScopeCompatible(currentScopes: VariableScope[], suggestedScopes: VariableScope[]) {
  if (!currentScopes.length) return false;

  return suggestedScopes.every(function (scope) {
    return currentScopes.indexOf(scope) !== -1;
  });
}

// Turns a list of candidate scope *combinations* (ranked, most-likely first) into a
// ranked list of individual scopes, for use as quick-pick chips. Earlier combos count
// for more, so a scope that shows up in the top combo outweighs one that only appears
// further down the list.
function rankIndividualScopes(alternatives: VariableScope[][], take: number): VariableScope[] {
  const weightByScope = new Map<VariableScope, number>();

  alternatives.forEach(function (combo, index) {
    const comboWeight = alternatives.length - index;

    combo.forEach(function (scope) {
      weightByScope.set(scope, (weightByScope.get(scope) || 0) + comboWeight);
    });
  });

  return Array.from(weightByScope.entries())
    .sort(function (a, b) {
      return b[1] - a[1];
    })
    .slice(0, take)
    .map(function (entry) {
      return entry[0];
    });
}

async function buildScopeReview(): Promise<{ items: ScopeReviewItem[]; summary: string }> {
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

  const items: ScopeReviewItem[] = [];

  for (const variableId of uniqueVariableIds) {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    if (!variable || variable.remote) continue;

    const allowedScopes = getAllowedScopesByType(variable.resolvedType);
    const suggestion = suggestScopesFromName(variable);
    const suggestedScopes = suggestion.scopes.filter(function (scope) {
      return allowedScopes.includes(scope);
    });
    const currentScopes = variable.scopes.filter(function (scope) {
      return allowedScopes.includes(scope);
    });

    const selectedScopes: VariableScope[] =
      suggestedScopes.length > 0
        ? suggestedScopes.slice(0, 3)
        : currentScopes.length > 0
          ? currentScopes.slice(0, 3)
          : (["ALL_SCOPES"] as VariableScope[]);

    const isScopeMatched =
      suggestedScopes.length > 0
        ? isCurrentScopeCompatible(currentScopes, suggestedScopes)
        : currentScopes.length > 0;

    items.push({
      variableId: variable.id,
      variableName: variable.name,
      currentScopesText: currentScopes.length ? currentScopes.join(", ") : "No scopes set",
      suggestedScopesText: suggestedScopes.length ? suggestedScopes.join(", ") : "No suggestion",
      suggestedScopes: suggestedScopes,
      selectedScopes: selectedScopes,
      allowedScopes: allowedScopes,
      isScopeMatched: isScopeMatched,
      confidence: suggestion.confidence,
      isLegacySizeStructure: isLegacySizeStructure(getVariableNameSegments(variable.name))
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

  const summary =
    "Выбрано объектов: " + selectedRoots.length + "\n" +
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

async function applyVariableScopes(variableId: string, scopes: VariableScope[]) {
  const variable = await figma.variables.getVariableByIdAsync(variableId);

  if (!variable) {
    throw new Error("Variable not found");
  }

  if (variable.remote) {
    throw new Error("Токен " + variable.name + " нельзя изменить из этого файла");
  }

  const cleanedScopes = Array.from(new Set(scopes.filter(Boolean))) as VariableScope[];
  variable.scopes = cleanedScopes;
}

async function buildAndApplyScopeFix(folderId?: string): Promise<ScopeFixResult> {
  const allLocalVariables = (await figma.variables.getLocalVariablesAsync()).filter(function (variable) {
    return !variable.remote;
  });

  let localVariables = allLocalVariables;

  if (folderId) {
    const collectionsById = await getLocalCollectionNamesById();
    localVariables = allLocalVariables.filter(function (variable) {
      return getVariableFolderId(variable, collectionsById) === folderId;
    });
  }

  const changes: ScopeFixChange[] = [];
  const needsReview: ScopeFixReviewEntry[] = [];

  let legacySizeCount = 0;

  for (const variable of localVariables) {
    const allowedScopes = getAllowedScopesByType(variable.resolvedType);
    const suggestion = suggestScopesFromName(variable);
    const suggestedScopes = suggestion.scopes.filter(function (scope) {
      return allowedScopes.includes(scope);
    });
    const currentScopes = variable.scopes.filter(function (scope) {
      return allowedScopes.includes(scope);
    });
    const segments = getVariableNameSegments(variable.name);
    const isLegacySize = isLegacySizeStructure(segments);

    if (isLegacySize) {
      legacySizeCount += 1;
    }

    if (!suggestedScopes.length || isCurrentScopeCompatible(currentScopes, suggestedScopes)) {
      continue;
    }

    const currentScopesText = currentScopes.length ? currentScopes.join(", ") : "No scopes set";
    const suggestedScopesText = suggestedScopes.join(", ");

    // Only auto-apply when nothing meaningful was set before (empty or ALL_SCOPES) —
    // a variable that already has a specific, different scope may be intentionally
    // shared across several bindable properties, so overwriting it needs a human look
    // even when our own suggestion is normally high-confidence.
    if (suggestion.confidence === "high" && isScopeUnset(currentScopes)) {
      variable.scopes = suggestedScopes as VariableScope[];
      changes.push({
        variableId: variable.id,
        variableName: variable.name,
        fromScopesText: currentScopesText,
        toScopesText: suggestedScopesText,
        isLegacySizeStructure: isLegacySize
      });
    } else {
      const alternatives = suggestion.alternatives || [suggestedScopes];

      needsReview.push({
        variableId: variable.id,
        variableName: variable.name,
        currentScopesText: currentScopesText,
        quickScopes: rankIndividualScopes(alternatives, 2),
        allowedScopes: allowedScopes,
        isLegacySizeStructure: isLegacySize
      });
    }
  }

  const sortedChanges = changes.sort(function (a, b) {
    return a.variableName.localeCompare(b.variableName);
  });
  const sortedNeedsReview = needsReview.sort(function (a, b) {
    return a.variableName.localeCompare(b.variableName);
  });

  const summary =
    (folderId ? "Папка: " + folderId + "\n" : "") +
    (folderId
      ? "Проверено токенов в папке: " + localVariables.length + " из " + allLocalVariables.length + " локальных\n"
      : "Проверено локальных токенов: " + localVariables.length + "\n") +
    "Исправлено автоматически: " + sortedChanges.length + "\n" +
    "Требуют ручной проверки: " + sortedNeedsReview.length +
    (legacySizeCount > 0 ? "\nУстаревшая структура имени (small/medium/large в пути): " + legacySizeCount : "") +
    (sortedChanges.length === 0 && sortedNeedsReview.length === 0
      ? "\n\nВсе scope уже соответствуют паттернам именования."
      : "");

  return {
    summary: summary,
    changes: sortedChanges,
    needsReview: sortedNeedsReview
  };
}

figma.ui.onmessage = async function (msg: PluginMessage) {
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

  if (msg.type === "run-list-scope-fix-folders") {
    postScopeFixFolders(await listScopeFixFolders());
    return;
  }

  if (msg.type === "run-fix-scope") {
    postScopeFixResult(await buildAndApplyScopeFix(msg.folderId));
    return;
  }

  if (msg.type === "run-library-review") {
    postLibraryReview(await buildLibraryReview());
    return;
  }

  if (msg.type === "select-nodes") {
    postSelectNodesResult(await selectNodesByIds(msg.nodeIds));
    return;
  }

  if (msg.type === "run-apply-token-review") {
    const result = await buildApplyTokenReview();
    postApplyTokenReview(result);
    return;
  }

  if (msg.type === "apply-scope") {
    try {
      const appliedScopes = Array.from(new Set(msg.scopes.filter(Boolean))).slice(0, 3) as VariableScope[];
      await applyVariableScopes(msg.variableId, appliedScopes);
      postApplyResult("Scope успешно применен.", {
        variableId: msg.variableId,
        scopes: appliedScopes
      });
    } catch (error) {
      postAnalysis(
        "Не удалось применить scope: " + (error instanceof Error ? error.message : "Unknown error")
      );
    }
    return;
  }

  if (msg.type === "apply-all-scopes") {
    let successCount = 0;
    const errors: string[] = [];
    const updates: Array<{ variableId: string; scopes: VariableScope[] }> = [];

    for (const update of msg.updates) {
      try {
        const appliedScopes = Array.from(new Set(update.scopes.filter(Boolean))).slice(0, 3) as VariableScope[];
        await applyVariableScopes(update.variableId, appliedScopes);
        updates.push({
          variableId: update.variableId,
          scopes: appliedScopes
        });
        successCount += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Unknown error");
      }
    }

    if (errors.length > 0) {
      postApplyResult(
        "Применено: " + successCount + "\nОшибок: " + errors.length + "\n" + errors.join("\n"),
        { updates: updates }
      );
    } else {
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
    } catch (error) {
      postApplyTokenResult(
        "Не удалось применить токен: " + (error instanceof Error ? error.message : "Unknown error"),
        {
          itemId: msg.itemId
        }
      );
    }

    return;
  }

  if (msg.type === "apply-all-tokens") {
    let successCount = 0;
    const appliedGroupIds: string[] = [];
    const errors: string[] = [];

    for (const update of msg.updates) {
      try {
        await applyTokenToTarget(update.nodeId, update.variableId, update.target);
        successCount += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Unknown error");
      }
    }

    const groupIds = Array.from(new Set(msg.updates.map(function (update) {
      return update.groupId;
    })));
    appliedGroupIds.push(...groupIds);

    if (errors.length > 0) {
      postApplyAllTokensResult(
        "Применено токенов: " + successCount + "\nОшибок: " + errors.length,
        { groupIds: appliedGroupIds }
      );
    } else {
      postApplyAllTokensResult("Готово. Применено токенов: " + successCount, {
        groupIds: appliedGroupIds
      });
    }
  }
};
