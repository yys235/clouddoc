"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type AncestorItem, softDeleteDocument, updateDocumentContent } from "@/lib/api";
import { type DocumentViewModel } from "@/lib/mock-document";

type BoardNodeType =
  | "text"
  | "rectangle"
  | "round_rectangle"
  | "ellipse"
  | "diamond"
  | "cylinder"
  | "predefined_process"
  | "trapezoid"
  | "document"
  | "comment_bubble"
  | "cloud"
  | "left_arrow"
  | "triangle"
  | "star"
  | "arrow"
  | "parallelogram"
  | "hexagon"
  | "plus";
type BoardTool = "select" | "pan" | "shape" | "text" | "connector";
type BoardAnchor = "top" | "right" | "bottom" | "left";
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type ToolbarPanel = "shape" | "fill" | "stroke" | "text" | "textStyle" | "line" | "more" | "multiFilter" | "multiMore" | null;
type ConnectorRoutingMode = "straight" | "orthogonal" | "polyline" | "rounded-orthogonal";
type BoardPoint = { x: number; y: number };
type BoardWaypoint = BoardPoint;
type BoardRect = { x: number; y: number; width: number; height: number };
type MultiSelectionFilter = "all" | "connector" | `node:${BoardNodeType}`;
type SelectionRectState = { start: BoardPoint; current: BoardPoint };
type QuickAddPreviewState = { sourceNodeId: string; anchor: BoardAnchor };
type QuickAddPressState = {
  sourceNodeId: string;
  anchor: BoardAnchor;
  startClientX: number;
  startClientY: number;
  latestClientX: number;
  latestClientY: number;
  startedConnection: boolean;
};
type ShapePlacementPreviewState = { type: BoardNodeType; x: number; y: number; width: number; height: number };
type MultiSelectionOption = { key: MultiSelectionFilter; label: string; count: number };
type BoardIconName =
  | "orb"
  | "geomix"
  | "select"
  | "shape"
  | "text"
  | "connector"
  | "pan"
  | "frame"
  | "stacked"
  | "table"
  | "pen"
  | "sliders"
  | "faceplus"
  | "dotsgrid"
  | "undo"
  | "redo"
  | "delete"
  | "comment"
  | "more"
  | "share"
  | "edit";

type BoardNode = {
  id: string;
  type: BoardNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  manualSize: boolean;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    fontSize: number;
    fontWeight?: number;
    color: string;
    textAlign?: "left" | "center" | "right";
  };
  zIndex: number;
};
type ConnectorEndpoint = { nodeId: string; anchor: BoardAnchor };
type BoardConnector = {
  id: string;
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  routingMode: ConnectorRoutingMode;
  waypoints: BoardWaypoint[];
  label?: string;
  labelPosition?: BoardPoint;
  labelSegmentIndex?: number;
  labelSegmentT?: number;
  style: {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    startArrow?: "none" | "arrow";
    endArrow?: "none" | "arrow";
    cornerRadius?: number;
  };
  zIndex: number;
};
type BoardState = {
  type: "board";
  version: number;
  viewport: { x: number; y: number; zoom: number };
  nodes: BoardNode[];
  connectors: BoardConnector[];
};
type BoardSnapshot = {
  nodes: BoardNode[];
  connectors: BoardConnector[];
  viewport: BoardState["viewport"];
};

const DEFAULT_NODE_STYLE = {
  fill: "#dfeaff",
  stroke: "#5b8cff",
  strokeWidth: 2,
  strokeDasharray: "",
  fontSize: 14,
  fontWeight: 400,
  color: "#1f2937",
  textAlign: "center" as const,
};
const DEFAULT_NODE_FILL_OPACITY = 0.74;
const LEGACY_DEFAULT_NODE_FILL = "#e8f0ff";
const LEGACY_DEFAULT_NODE_STROKE = "#5b7fd8";
const LEGACY_DEFAULT_NODE_STROKE_WIDTH = 1;
const DEFAULT_CONNECTOR_STYLE = {
  stroke: "#c2c8cc",
  strokeWidth: 2,
  strokeDasharray: "",
  startArrow: "none" as const,
  endArrow: "arrow" as const,
  cornerRadius: 12,
};
const CONNECTOR_ENDPOINT_STUB = 24;
const LEGACY_DEFAULT_CONNECTOR_STROKE = "#8b95a5";
const LEGACY_DEFAULT_CONNECTOR_STROKE_WIDTH = 1.5;
const SHAPE_ITEMS: Array<{ type: BoardNodeType; label: string; icon: string }> = [
  { type: "rectangle", label: "矩形", icon: "▭" },
  { type: "ellipse", label: "圆形", icon: "○" },
  { type: "diamond", label: "菱形", icon: "◇" },
  { type: "round_rectangle", label: "圆角矩形", icon: "▢" },
  { type: "cylinder", label: "圆柱", icon: "⌭" },
  { type: "parallelogram", label: "平行四边形", icon: "▱" },
  { type: "hexagon", label: "六边形", icon: "⬡" },
  { type: "trapezoid", label: "梯形", icon: "⏢" },
  { type: "predefined_process", label: "预定义流程", icon: "⬢" },
  { type: "document", label: "文档", icon: "🗎" },
  { type: "comment_bubble", label: "对话气泡", icon: "◔" },
  { type: "left_arrow", label: "左箭头", icon: "←" },
  { type: "arrow", label: "右箭头", icon: "→" },
  { type: "triangle", label: "三角形", icon: "△" },
  { type: "star", label: "星形", icon: "☆" },
  { type: "cloud", label: "云朵", icon: "☁" },
  { type: "plus", label: "加号", icon: "✚" },
];
const COLOR_SWATCHES = [
  "#ffffff", "#f8fafc", "#e2e8f0", "#94a3b8", "#1f2937", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#10b981", "#06b6d4", "#0ea5e9", "#2563eb", "#4f46e5",
  "#7c3aed", "#a855f7", "#d946ef", "#ec4899", "#fce7f3", "#fee2e2", "#fef3c7", "#dcfce7",
  "#e0f2fe", "#dbeafe", "#e8f0ff", "transparent",
];
const RESIZE_HANDLES: Array<{ id: ResizeHandle; cursor: string; x: number; y: number }> = [
  { id: "nw", cursor: "nwse-resize", x: 0, y: 0 },
  { id: "n", cursor: "ns-resize", x: 0.5, y: 0 },
  { id: "ne", cursor: "nesw-resize", x: 1, y: 0 },
  { id: "e", cursor: "ew-resize", x: 1, y: 0.5 },
  { id: "se", cursor: "nwse-resize", x: 1, y: 1 },
  { id: "s", cursor: "ns-resize", x: 0.5, y: 1 },
  { id: "sw", cursor: "nesw-resize", x: 0, y: 1 },
  { id: "w", cursor: "ew-resize", x: 0, y: 0.5 },
];
const ANCHORS: BoardAnchor[] = ["top", "right", "bottom", "left"];

function BoardIcon({ name, className = "h-[18px] w-[18px]" }: { name: BoardIconName; className?: string }) {
  const stroke = "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 2.05, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {name === "orb" ? (
        <defs>
          <linearGradient id="board-orb-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8f5cff" />
            <stop offset="55%" stopColor="#ff77a8" />
            <stop offset="100%" stopColor="#ffb14a" />
          </linearGradient>
          <linearGradient id="board-orb-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6c7cff" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      ) : null}
      {name === "orb" ? (
        <>
          <path d="M12 4.5a7.5 7.5 0 017.5 7.5" fill="none" stroke="url(#board-orb-a)" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M19.5 12A7.5 7.5 0 0112 19.5" fill="none" stroke="url(#board-orb-b)" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M12 19.5A7.5 7.5 0 014.5 12" fill="none" stroke="#ff8a65" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M4.5 12A7.5 7.5 0 0112 4.5" fill="none" stroke="#b388ff" strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : null}
      {name === "geomix" ? (
        <>
          <rect x="9.8" y="10.2" width="7.3" height="7.3" rx="1.5" fill="none" stroke="#ffb300" strokeWidth="1.9" transform="rotate(-17 13.45 13.85)" />
          <circle cx="8.4" cy="14.9" r="3.8" fill="none" stroke="#5c6cff" strokeWidth="1.9" />
          <path d="M12.7 6.7l3.7 6.4H9z" fill="none" stroke="#ff7a45" strokeWidth="1.9" strokeLinejoin="round" />
        </>
      ) : null}
      {name === "select" ? (
        <>
          <path d="M6 4.5l7 8.4-3.35.73L8.4 18.2 6 4.5z" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.2 11.1l3.7 3.7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </>
      ) : null}
      {name === "shape" ? (
        <>
          <circle {...common} cx="8" cy="8" r="3.2" />
          <path {...common} d="M14.5 6.2h4.2v4.2h-4.2zM6 16.5h5.2M8.6 13.9v5.2M15.2 15.2l4.4 4.4M19.6 15.2l-4.4 4.4" />
        </>
      ) : null}
      {name === "text" ? (
        <>
          <path d="M7 6.5h10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M12 6.5v11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M9.3 17.5h5.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </>
      ) : null}
      {name === "connector" ? (
        <>
          <path d="M7 16.5c4.9 0 3.4-8.2 7.7-8.2h2.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14.9 5.8l2.7 2.5-2.7 2.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === "pan" ? (
        <>
          <path d="M9 18.7c-1.7 0-3-.5-4.2-2l-1.45-1.92a1.2 1.2 0 011.78-1.6L7 14.8V8.2a1.45 1.45 0 112.9 0v2.1m0-2.7a1.4 1.4 0 112.8 0v2.7m0-2a1.35 1.35 0 112.7 0v2m0-.95a1.3 1.3 0 112.6 0v3.68c0 2.95-2.12 4.64-5 4.64H9z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === "frame" ? <rect {...common} x="5" y="5" width="14" height="14" /> : null}
      {name === "stacked" ? (
        <>
          <rect {...common} x="4.5" y="9" width="9.5" height="7.5" rx="1.2" />
          <rect {...common} x="10" y="6.5" width="9.5" height="7.5" rx="1.2" />
        </>
      ) : null}
      {name === "table" ? (
        <>
          <rect {...common} x="4.5" y="5" width="15" height="14" />
          <path {...common} d="M4.5 10h15M9.5 5v14M14.5 5v14" />
        </>
      ) : null}
      {name === "pen" ? (
        <>
          <path {...common} d="M5 18.8l3.5-.8 8.8-8.8a2 2 0 10-2.9-2.8l-8.8 8.8L5 18.8z" />
          <path {...common} d="M14.1 7.1l2.8 2.8M7 20.2c1-.9 1.9-1.3 3.1-1.3 1.5 0 2.2.6 3.1.6 1.1 0 1.8-.3 2.8-1" />
        </>
      ) : null}
      {name === "sliders" ? (
        <>
          <path {...common} d="M5 8h14M5 12h14M5 16h14" />
          <circle cx="10" cy="8" r="1.8" fill="#fff" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="15" cy="12" r="1.8" fill="#fff" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="8" cy="16" r="1.8" fill="#fff" stroke="currentColor" strokeWidth="1.7" />
        </>
      ) : null}
      {name === "faceplus" ? (
        <>
          <circle {...common} cx="11" cy="12" r="6.5" />
          <path {...common} d="M8.7 10.5h.01M13.3 10.5h.01M8.7 14.3c1.4 1.2 3.2 1.2 4.6 0" />
          <path {...common} d="M18 6v4M16 8h4" />
        </>
      ) : null}
      {name === "dotsgrid" ? (
        <>
          {[
            [7, 7], [12, 7], [17, 7],
            [7, 12], [12, 12], [17, 12],
            [7, 17], [12, 17], [17, 17],
          ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" />)}
        </>
      ) : null}
      {name === "undo" ? <path {...common} d="M9 7H5v4M5.5 11A7.5 7.5 0 1110 18.3" /> : null}
      {name === "redo" ? <path {...common} d="M15 7h4v4M18.5 11A7.5 7.5 0 1014 18.3" /> : null}
      {name === "delete" ? (
        <>
          <path {...common} d="M5 7h14M10 11v5M14 11v5M8 7l.7 12h6.6L16 7M9.5 7l.7-2h3.6l.7 2" />
        </>
      ) : null}
      {name === "comment" ? <path {...common} d="M5 6.5h14v9H9l-4 3v-12z" /> : null}
      {name === "more" ? <path {...common} d="M6 12h.01M12 12h.01M18 12h.01" /> : null}
      {name === "share" ? <path {...common} d="M8 12l8-5M8 12l8 5M7 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 19.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /> : null}
      {name === "edit" ? <path {...common} d="M5 19h14M7 15l8.5-8.5a2.1 2.1 0 013 3L10 18H7v-3z" /> : null}
    </svg>
  );
}

function ShapeIcon({ type, className = "h-[18px] w-[18px]" }: { type: BoardNodeType; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {type === "rectangle" ? <rect {...common} x="5" y="7" width="14" height="10" /> : null}
      {type === "round_rectangle" ? <rect {...common} x="5" y="7" width="14" height="10" rx="2.4" /> : null}
      {type === "ellipse" ? <ellipse {...common} cx="12" cy="12" rx="7" ry="5" /> : null}
      {type === "diamond" ? <path {...common} d="M12 4l8 8-8 8-8-8 8-8z" /> : null}
      {type === "cylinder" ? (
        <>
          <path {...common} d="M6 7c0-2 12-2 12 0v10c0 2-12 2-12 0V7z" />
          <path {...common} d="M6 7c0 2 12 2 12 0M6 17c0-2 12-2 12 0" />
        </>
      ) : null}
      {type === "predefined_process" ? <path {...common} d="M7 6.5h10L20 12l-3 5.5H7L4 12l3-5.5z" /> : null}
      {type === "trapezoid" ? <path {...common} d="M8 6.5h8.5l2 11H5.5l2.5-11z" /> : null}
      {type === "document" ? <path {...common} d="M6 6.5h12v9.5l-1.6 1.5H7.8L6 16V6.5zM6.4 16.2h11.2M9 10.2h6M9 13h5" /> : null}
      {type === "comment_bubble" ? <path {...common} d="M6.5 7.2h11a2.3 2.3 0 012.3 2.3v4.8a2.3 2.3 0 01-2.3 2.3H11l-3.9 2.8v-2.8H6.5a2.3 2.3 0 01-2.3-2.3V9.5a2.3 2.3 0 012.3-2.3z" /> : null}
      {type === "cloud" ? <path {...common} d="M8.5 18c-2 0-3.5-1.4-3.5-3.1 0-1.5 1.1-2.7 2.6-3 .4-2.4 2.5-4.1 5-4.1 2.6 0 4.8 1.8 5.1 4.3 1.8.2 3.2 1.5 3.2 3.1 0 1.8-1.6 3.3-3.7 3.3h-8.7z" /> : null}
      {type === "left_arrow" ? <path {...common} d="M20 9h-9V5l-7 7 7 7v-4h9V9z" /> : null}
      {type === "arrow" ? <path {...common} d="M4 9h9V5l7 7-7 7v-4H4V9z" /> : null}
      {type === "parallelogram" ? <path {...common} d="M8 6h12l-4 12H4L8 6z" /> : null}
      {type === "hexagon" ? <path {...common} d="M8 5h8l5 7-5 7H8l-5-7 5-7z" /> : null}
      {type === "triangle" ? <path {...common} d="M12 4l8 16H4L12 4z" /> : null}
      {type === "star" ? <path {...common} d="M12 4l2.2 5 5.3.5-4 3.5 1.2 5.2L12 15.5l-4.7 2.7L8.5 13l-4-3.5 5.3-.5L12 4z" /> : null}
      {type === "plus" ? <path {...common} d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z" /> : null}
      {type === "text" ? <path {...common} d="M5 6h14M12 6v12M8.5 18h7" /> : null}
    </svg>
  );
}

function emptyBoardState(): BoardState {
  return {
    type: "board",
    version: 2,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    connectors: [],
  };
}

function normalizeEndpoint(raw: unknown, fallbackAnchor: BoardAnchor): ConnectorEndpoint | null {
  if (typeof raw === "string" && raw.trim()) {
    return { nodeId: raw, anchor: fallbackAnchor };
  }
  if (!raw || typeof raw !== "object") return null;
  const endpoint = raw as Record<string, unknown>;
  const nodeId = String(endpoint.nodeId || endpoint.node_id || "").trim();
  const anchor = String(endpoint.anchor || fallbackAnchor) as BoardAnchor;
  if (!nodeId || !ANCHORS.includes(anchor)) return null;
  return { nodeId, anchor };
}

function normalizeConnectorRouting(value: unknown): ConnectorRoutingMode {
  return value === "straight" || value === "orthogonal" || value === "polyline" || value === "rounded-orthogonal"
    ? value
    : "rounded-orthogonal";
}

function normalizeDefaultNodeFill(type: BoardNodeType, value: unknown) {
  const fill = String(value ?? (type === "text" ? "transparent" : DEFAULT_NODE_STYLE.fill));
  if (type === "text") return fill;
  return fill === LEGACY_DEFAULT_NODE_FILL ? DEFAULT_NODE_STYLE.fill : fill;
}

function normalizeDefaultNodeStroke(value: unknown) {
  const stroke = String(value || DEFAULT_NODE_STYLE.stroke);
  return stroke === LEGACY_DEFAULT_NODE_STROKE ? DEFAULT_NODE_STYLE.stroke : stroke;
}

function normalizeDefaultNodeStrokeWidth(value: unknown) {
  const strokeWidth = Number(value ?? DEFAULT_NODE_STYLE.strokeWidth) || DEFAULT_NODE_STYLE.strokeWidth;
  return strokeWidth === LEGACY_DEFAULT_NODE_STROKE_WIDTH ? DEFAULT_NODE_STYLE.strokeWidth : strokeWidth;
}

function normalizeDefaultConnectorStroke(value: unknown) {
  const stroke = String(value || DEFAULT_CONNECTOR_STYLE.stroke);
  return stroke === LEGACY_DEFAULT_CONNECTOR_STROKE ? DEFAULT_CONNECTOR_STYLE.stroke : stroke;
}

function normalizeDefaultConnectorStrokeWidth(value: unknown) {
  const strokeWidth = Number(value ?? DEFAULT_CONNECTOR_STYLE.strokeWidth) || DEFAULT_CONNECTOR_STYLE.strokeWidth;
  return strokeWidth === LEGACY_DEFAULT_CONNECTOR_STROKE_WIDTH ? DEFAULT_CONNECTOR_STYLE.strokeWidth : strokeWidth;
}

function boardNodeTextLines(node: Pick<BoardNode, "text" | "width" | "style">, text = node.text) {
  const fontSize = Number(node.style.fontSize || DEFAULT_NODE_STYLE.fontSize) || DEFAULT_NODE_STYLE.fontSize;
  const maxUnits = Math.max(4, Math.max(20, node.width - 24) / Math.max(8, fontSize));
  return wrapText(text, maxUnits);
}

function requiredNodeHeightForText(node: Pick<BoardNode, "type" | "text" | "width" | "height" | "style">, text = node.text) {
  if (!text.trim()) return node.height;
  const fontSize = Number(node.style.fontSize || DEFAULT_NODE_STYLE.fontSize) || DEFAULT_NODE_STYLE.fontSize;
  const lineHeight = fontSize * 1.25;
  const verticalPadding = node.type === "text" ? 14 : 18;
  const lines = boardNodeTextLines(node, text);
  return Math.ceil(lines.length * lineHeight + verticalPadding * 2);
}

function fitNodeHeightToText(node: BoardNode, text = node.text) {
  const minHeight = defaultNodeSize(node.type).height;
  const requiredHeight = requiredNodeHeightForText(node, text);
  const nextHeight = Math.max(minHeight, node.height, requiredHeight);
  return nextHeight === node.height && text === node.text ? node : { ...node, text, height: nextHeight };
}

function normalizeWaypoints(raw: unknown): BoardWaypoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const point = item as Record<string, unknown>;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ x, y }];
  });
}

function normalizeBoardState(raw: Record<string, unknown>): BoardState {
  if (raw.type !== "board") return emptyBoardState();
  const viewport = raw.viewport && typeof raw.viewport === "object" ? raw.viewport as Record<string, unknown> : {};
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const connectors = Array.isArray(raw.connectors) ? raw.connectors : [];
  return {
    type: "board",
    version: 2,
    viewport: {
      x: Number(viewport.x ?? 0) || 0,
      y: Number(viewport.y ?? 0) || 0,
      zoom: Math.min(4, Math.max(0.25, Number(viewport.zoom ?? 1) || 1)),
    },
    nodes: nodes.flatMap((item): BoardNode[] => {
      if (!item || typeof item !== "object") return [];
      const node = item as Record<string, unknown>;
      const type = String(node.type || "rectangle") as BoardNodeType;
      if (!SHAPE_ITEMS.some((shape) => shape.type === type) && type !== "text") return [];
      const style = node.style && typeof node.style === "object" ? node.style as Record<string, unknown> : {};
      const normalizedNode: BoardNode = {
        id: String(node.id || crypto.randomUUID()),
        type,
        x: Number(node.x ?? 120) || 120,
        y: Number(node.y ?? 100) || 100,
        width: Math.max(48, Number(node.width ?? 160) || 160),
        height: Math.max(32, Number(node.height ?? 64) || 64),
        text: String(node.text ?? ""),
        manualSize: Boolean(node.manualSize ?? node.manual_size ?? false),
        style: {
          fill: normalizeDefaultNodeFill(type, style.fill),
          stroke: normalizeDefaultNodeStroke(style.stroke),
          strokeWidth: normalizeDefaultNodeStrokeWidth(style.strokeWidth),
          strokeDasharray: String(style.strokeDasharray || ""),
          fontSize: Number(style.fontSize ?? DEFAULT_NODE_STYLE.fontSize) || DEFAULT_NODE_STYLE.fontSize,
          fontWeight: Number(style.fontWeight ?? DEFAULT_NODE_STYLE.fontWeight) || DEFAULT_NODE_STYLE.fontWeight,
          color: String(style.color || DEFAULT_NODE_STYLE.color),
          textAlign: ["left", "center", "right"].includes(String(style.textAlign)) ? style.textAlign as BoardNode["style"]["textAlign"] : "center",
        },
        zIndex: Number(node.zIndex ?? 1) || 1,
      };
      return [normalizedNode.manualSize ? normalizedNode : fitNodeHeightToText(normalizedNode)];
    }),
    connectors: connectors.flatMap((item): BoardConnector[] => {
      if (!item || typeof item !== "object") return [];
      const connector = item as Record<string, unknown>;
      const from = normalizeEndpoint(connector.from, "right");
      const to = normalizeEndpoint(connector.to, "left");
      if (!from || !to) return [];
      const style = connector.style && typeof connector.style === "object" ? connector.style as Record<string, unknown> : {};
      return [{
        id: String(connector.id || crypto.randomUUID()),
        from,
        to,
        routingMode: normalizeConnectorRouting(connector.routingMode ?? connector.routing),
        waypoints: normalizeWaypoints(connector.waypoints),
        label: String(connector.label || ""),
        labelPosition: (() => {
          const rawPosition = connector.labelPosition || connector.label_position;
          if (!rawPosition || typeof rawPosition !== "object") return undefined;
          const point = rawPosition as Record<string, unknown>;
          return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : undefined;
        })(),
        labelSegmentIndex: typeof connector.labelSegmentIndex === "number" ? connector.labelSegmentIndex : typeof connector.label_segment_index === "number" ? connector.label_segment_index : undefined,
        labelSegmentT: typeof connector.labelSegmentT === "number" ? connector.labelSegmentT : typeof connector.label_segment_t === "number" ? connector.label_segment_t : undefined,
        style: {
          stroke: normalizeDefaultConnectorStroke(style.stroke),
          strokeWidth: normalizeDefaultConnectorStrokeWidth(style.strokeWidth),
          strokeDasharray: String(style.strokeDasharray || ""),
          startArrow: style.startArrow === "arrow" ? "arrow" : "none",
          endArrow: style.endArrow === "none" ? "none" : "arrow",
          cornerRadius: Math.max(0, Number(style.cornerRadius ?? DEFAULT_CONNECTOR_STYLE.cornerRadius) || DEFAULT_CONNECTOR_STYLE.cornerRadius),
        },
        zIndex: Number(connector.zIndex ?? 0) || 0,
      }];
    }),
  };
}

function cloneSnapshot(state: BoardState): BoardSnapshot {
  return {
    nodes: structuredClone(state.nodes),
    connectors: structuredClone(state.connectors),
    viewport: { ...state.viewport },
  };
}

function snapshotEquals(left: BoardSnapshot | null, right: BoardState) {
  if (!left) return false;
  return JSON.stringify(left) === JSON.stringify(cloneSnapshot(right));
}

function nodeLabel(type: BoardNodeType) {
  const item = SHAPE_ITEMS.find((shape) => shape.type === type);
  if (item) return item.label;
  return "文本";
}

function anchorPoint(node: BoardNode, anchor: BoardAnchor) {
  if (anchor === "top") return { x: node.x + node.width / 2, y: node.y };
  if (anchor === "right") return { x: node.x + node.width, y: node.y + node.height / 2 };
  if (anchor === "bottom") return { x: node.x + node.width / 2, y: node.y + node.height };
  return { x: node.x, y: node.y + node.height / 2 };
}

function anchorAxis(anchor: BoardAnchor) {
  return anchor === "left" || anchor === "right" ? "horizontal" : "vertical";
}

function diamondPath(node: BoardNode) {
  const midX = node.x + node.width / 2;
  const midY = node.y + node.height / 2;
  return `${midX},${node.y} ${node.x + node.width},${midY} ${midX},${node.y + node.height} ${node.x},${midY}`;
}

function polygonPoints(node: BoardNode) {
  const { x, y, width, height } = node;
  if (node.type === "triangle") return `${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`;
  if (node.type === "parallelogram") return `${x + width * 0.18},${y} ${x + width},${y} ${x + width * 0.82},${y + height} ${x},${y + height}`;
  if (node.type === "hexagon") return `${x + width * 0.22},${y} ${x + width * 0.78},${y} ${x + width},${y + height / 2} ${x + width * 0.78},${y + height} ${x + width * 0.22},${y + height} ${x},${y + height / 2}`;
  if (node.type === "trapezoid") return trapezoidPoints(node);
  if (node.type === "predefined_process") return predefinedProcessPoints(node);
  if (node.type === "plus") return `${x + width * 0.38},${y} ${x + width * 0.62},${y} ${x + width * 0.62},${y + height * 0.38} ${x + width},${y + height * 0.38} ${x + width},${y + height * 0.62} ${x + width * 0.62},${y + height * 0.62} ${x + width * 0.62},${y + height} ${x + width * 0.38},${y + height} ${x + width * 0.38},${y + height * 0.62} ${x},${y + height * 0.62} ${x},${y + height * 0.38} ${x + width * 0.38},${y + height * 0.38}`;
  if (node.type === "star") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const outer = Math.min(width, height) / 2;
    const inner = outer * 0.45;
    return Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 === 0 ? outer : inner;
      return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
    }).join(" ");
  }
  return diamondPath(node);
}

function arrowPath(node: BoardNode) {
  const { x, y, width, height } = node;
  return `M ${x} ${y + height * 0.28} L ${x + width * 0.62} ${y + height * 0.28} L ${x + width * 0.62} ${y} L ${x + width} ${y + height / 2} L ${x + width * 0.62} ${y + height} L ${x + width * 0.62} ${y + height * 0.72} L ${x} ${y + height * 0.72} Z`;
}

function leftArrowPath(node: BoardNode) {
  const { x, y, width, height } = node;
  return `M ${x + width} ${y + height * 0.28} L ${x + width * 0.38} ${y + height * 0.28} L ${x + width * 0.38} ${y} L ${x} ${y + height / 2} L ${x + width * 0.38} ${y + height} L ${x + width * 0.38} ${y + height * 0.72} L ${x + width} ${y + height * 0.72} Z`;
}

function trapezoidPoints(node: BoardNode) {
  const { x, y, width, height } = node;
  return `${x + width * 0.16},${y} ${x + width * 0.84},${y} ${x + width},${y + height} ${x},${y + height}`;
}

function predefinedProcessPoints(node: BoardNode) {
  const { x, y, width, height } = node;
  return `${x + width * 0.14},${y} ${x + width * 0.86},${y} ${x + width},${y + height / 2} ${x + width * 0.86},${y + height} ${x + width * 0.14},${y + height} ${x},${y + height / 2}`;
}

function documentPath(node: BoardNode) {
  const { x, y, width, height } = node;
  return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height * 0.8} L ${x + width * 0.86} ${y + height} L ${x + width * 0.12} ${y + height} L ${x} ${y + height * 0.8} Z`;
}

function commentBubblePath(node: BoardNode) {
  const { x, y, width, height } = node;
  const tailX = x + width * 0.26;
  return `M ${x + 10} ${y} H ${x + width - 10} Q ${x + width} ${y} ${x + width} ${y + 10} V ${y + height - 18} Q ${x + width} ${y + height - 8} ${x + width - 10} ${y + height - 8} H ${tailX + 14} L ${tailX - 10} ${y + height} L ${tailX - 4} ${y + height - 8} H ${x + 10} Q ${x} ${y + height - 8} ${x} ${y + height - 18} V ${y + 10} Q ${x} ${y} ${x + 10} ${y} Z`;
}

function cloudPath(node: BoardNode) {
  const { x, y, width, height } = node;
  const cy = y + height * 0.54;
  return [
    `M ${x + width * 0.2} ${y + height * 0.82}`,
    `C ${x + width * 0.08} ${y + height * 0.82}, ${x + width * 0.02} ${cy + height * 0.05}, ${x + width * 0.12} ${cy}`,
    `C ${x + width * 0.1} ${y + height * 0.28}, ${x + width * 0.28} ${y + height * 0.1}, ${x + width * 0.42} ${y + height * 0.2}`,
    `C ${x + width * 0.48} ${y + height * 0.02}, ${x + width * 0.7} ${y + height * 0.02}, ${x + width * 0.78} ${y + height * 0.2}`,
    `C ${x + width * 0.94} ${y + height * 0.2}, ${x + width} ${y + height * 0.36}, ${x + width * 0.92} ${cy}`,
    `C ${x + width * 1.02} ${cy + height * 0.06}, ${x + width * 0.92} ${y + height * 0.84}, ${x + width * 0.78} ${y + height * 0.82}`,
    `Z`,
  ].join(" ");
}

function defaultNodeSize(type: BoardNodeType) {
  if (type === "text") return { width: 180, height: 48 };
  if (type === "triangle" || type === "star" || type === "plus" || type === "cloud") return { width: 110, height: 92 };
  if (type === "comment_bubble" || type === "document") return { width: 176, height: 92 };
  if (type === "predefined_process" || type === "trapezoid") return { width: 174, height: 76 };
  if (type === "left_arrow" || type === "arrow") return { width: 170, height: 72 };
  return { width: 150, height: 62 };
}

function defaultNodeText(type: BoardNodeType) {
  return type === "text" ? "输入文本" : "输入文本";
}

function defaultConnectorWaypoints(
  start: BoardPoint,
  end: BoardPoint,
  fromAnchor: BoardAnchor,
  toAnchor: BoardAnchor,
  routingMode: ConnectorRoutingMode,
) {
  if (routingMode === "straight") return [];
  const fromAxis = anchorAxis(fromAnchor);
  const toAxis = anchorAxis(toAnchor);
  const gap = 36;
  if (routingMode === "polyline") {
    if (fromAxis === "vertical") {
      const outY = start.y + (fromAnchor === "bottom" ? gap : -gap);
      if (toAxis === "vertical") {
        const inY = end.y + (toAnchor === "bottom" ? -gap : gap);
        const midX = (start.x + end.x) / 2;
        return [
          { x: start.x, y: outY },
          { x: midX, y: outY },
          { x: midX, y: inY },
          { x: end.x, y: inY },
        ];
      }
      const inX = end.x + (toAnchor === "right" ? gap : -gap);
      const midX = (start.x + inX) / 2;
      return [
        { x: start.x, y: outY },
        { x: midX, y: outY },
        { x: midX, y: end.y },
        { x: inX, y: end.y },
      ];
    }
    const outX = start.x + (fromAnchor === "right" ? gap : -gap);
    if (toAxis === "horizontal") {
      const inX = end.x + (toAnchor === "right" ? -gap : gap);
      const midY = (start.y + end.y) / 2;
      return [
        { x: outX, y: start.y },
        { x: outX, y: midY },
        { x: inX, y: midY },
        { x: inX, y: end.y },
      ];
    }
    const inY = end.y + (toAnchor === "bottom" ? -gap : gap);
    const midY = (start.y + inY) / 2;
    return [
      { x: outX, y: start.y },
      { x: outX, y: midY },
      { x: end.x, y: midY },
      { x: end.x, y: inY },
    ];
  }
  if (fromAxis === "horizontal" && toAxis === "horizontal") {
    const midX = (start.x + end.x) / 2;
    return [{ x: midX, y: start.y }, { x: midX, y: end.y }];
  }
  if (fromAxis === "vertical" && toAxis === "vertical") {
    const midY = (start.y + end.y) / 2;
    return [{ x: start.x, y: midY }, { x: end.x, y: midY }];
  }
  if (fromAxis === "vertical") {
    return [{ x: start.x, y: end.y }];
  }
  return [{ x: end.x, y: start.y }];
}

function outwardPoint(point: BoardPoint, anchor: BoardAnchor, distance: number) {
  if (anchor === "top") return { x: point.x, y: point.y - distance };
  if (anchor === "bottom") return { x: point.x, y: point.y + distance };
  if (anchor === "left") return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function hasEndpointStub(points: BoardPoint[], endpoint: "start" | "end", anchor: BoardAnchor, minLength = CONNECTOR_ENDPOINT_STUB) {
  if (points.length < 2) return false;
  const point = endpoint === "start" ? points[0] : points[points.length - 1];
  const next = endpoint === "start" ? points[1] : points[points.length - 2];
  if (anchor === "left") return next.y === point.y && next.x <= point.x - minLength;
  if (anchor === "right") return next.y === point.y && next.x >= point.x + minLength;
  if (anchor === "top") return next.x === point.x && next.y <= point.y - minLength;
  return next.x === point.x && next.y >= point.y + minLength;
}

function protectConnectorEndpointStubs(points: BoardPoint[], fromAnchor: BoardAnchor, toAnchor: BoardAnchor) {
  if (points.length < 2) return points;
  let protectedPoints = simplifyOrthogonalPath(orthogonalizePath(points.map((point) => ({ ...point }))));
  if (!hasEndpointStub(protectedPoints, "start", fromAnchor)) {
    const start = protectedPoints[0];
    const startOut = outwardPoint(start, fromAnchor, CONNECTOR_ENDPOINT_STUB);
    const next = protectedPoints[1];
    const bendTarget = protectedPoints[2];
    if ((startOut.x === next.x || startOut.y === next.y) && bendTarget) {
      const bridge = anchorAxis(fromAnchor) === "horizontal"
        ? { x: startOut.x, y: bendTarget.y }
        : { x: bendTarget.x, y: startOut.y };
      protectedPoints = [start, startOut, bridge, ...protectedPoints.slice(2)];
    } else {
      const bridge = startOut.x === next.x || startOut.y === next.y
        ? []
        : anchorAxis(fromAnchor) === "horizontal"
          ? [{ x: startOut.x, y: next.y }]
          : [{ x: next.x, y: startOut.y }];
      protectedPoints = [start, startOut, ...bridge, ...protectedPoints.slice(1)];
    }
  }
  if (!hasEndpointStub(protectedPoints, "end", toAnchor)) {
    const end = protectedPoints[protectedPoints.length - 1];
    const endOut = outwardPoint(end, toAnchor, CONNECTOR_ENDPOINT_STUB);
    const previous = protectedPoints[protectedPoints.length - 2];
    const bridge = previous.x === endOut.x || previous.y === endOut.y
      ? []
      : anchorAxis(toAnchor) === "horizontal"
        ? [{ x: endOut.x, y: previous.y }]
        : [{ x: previous.x, y: endOut.y }];
    protectedPoints = [...protectedPoints.slice(0, -1), ...bridge, endOut, end];
  }
  return simplifyWaypoints(orthogonalizePath(protectedPoints));
}

function orthogonalizePath(points: BoardPoint[]) {
  if (points.length < 2) return points;
  const nextPoints: BoardPoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = nextPoints[nextPoints.length - 1];
    const current = points[index];
    if (previous.x !== current.x && previous.y !== current.y) {
      const beforePrevious = nextPoints.at(-2);
      if (beforePrevious && beforePrevious.x === previous.x) {
        nextPoints.push({ x: current.x, y: previous.y });
      } else {
        nextPoints.push({ x: previous.x, y: current.y });
      }
    }
    nextPoints.push(current);
  }
  return compactWaypoints(nextPoints);
}

function oppositeAnchor(anchor: BoardAnchor): BoardAnchor {
  if (anchor === "top") return "bottom";
  if (anchor === "bottom") return "top";
  if (anchor === "left") return "right";
  return "left";
}

function quickAddNodePosition(source: BoardNode, anchor: BoardAnchor, width: number, height: number) {
  const gap = 82;
  if (anchor === "top") {
    return { x: source.x + source.width / 2 - width / 2, y: source.y - gap - height };
  }
  if (anchor === "bottom") {
    return { x: source.x + source.width / 2 - width / 2, y: source.y + source.height + gap };
  }
  if (anchor === "left") {
    return { x: source.x - gap - width, y: source.y + source.height / 2 - height / 2 };
  }
  return { x: source.x + source.width + gap, y: source.y + source.height / 2 - height / 2 };
}

function quickAddSymbol(anchor: BoardAnchor) {
  if (anchor === "top") return "↑";
  if (anchor === "bottom") return "↓";
  if (anchor === "left") return "←";
  return "→";
}

function compactWaypoints(points: BoardPoint[]) {
  const compacted: BoardPoint[] = [];
  for (const point of points) {
    const previous = compacted.at(-1);
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      compacted.push(point);
    }
  }
  return compacted;
}

function simplifyWaypoints(points: BoardPoint[]) {
  const compacted = compactWaypoints(points);
  const simplified: BoardPoint[] = [];
  for (const point of compacted) {
    const previous = simplified.at(-1);
    const beforePrevious = simplified.at(-2);
    if (
      previous &&
      beforePrevious &&
      ((beforePrevious.x === previous.x && previous.x === point.x) ||
        (beforePrevious.y === previous.y && previous.y === point.y))
    ) {
      simplified[simplified.length - 1] = point;
    } else {
      simplified.push(point);
    }
  }
  const finalPoints = compactWaypoints(simplified);
  if (points.length >= 2 && finalPoints.length < 2) {
    return [points[0], points[points.length - 1]];
  }
  return finalPoints;
}

function simplifyOrthogonalPath(points: BoardPoint[]) {
  return mergeOverlappingOrthogonalSegments(simplifyWaypoints(points));
}

function mergeOverlappingOrthogonalSegments(points: BoardPoint[]) {
  let nextPoints = compactWaypoints(points);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < nextPoints.length - 3; index += 1) {
      const first = nextPoints[index];
      const second = nextPoints[index + 1];
      const third = nextPoints[index + 2];
      const fourth = nextPoints[index + 3];
      if (first.x === second.x && third.x === fourth.x && first.x === fourth.x) {
        const firstMin = Math.min(first.y, second.y);
        const firstMax = Math.max(first.y, second.y);
        const secondMin = Math.min(third.y, fourth.y);
        const secondMax = Math.max(third.y, fourth.y);
        if (Math.max(firstMin, secondMin) <= Math.min(firstMax, secondMax)) {
          nextPoints = [
            ...nextPoints.slice(0, index + 1),
            fourth,
            ...nextPoints.slice(index + 4),
          ];
          changed = true;
          break;
        }
      }
      if (first.y === second.y && third.y === fourth.y && first.y === fourth.y) {
        const firstMin = Math.min(first.x, second.x);
        const firstMax = Math.max(first.x, second.x);
        const secondMin = Math.min(third.x, fourth.x);
        const secondMax = Math.max(third.x, fourth.x);
        if (Math.max(firstMin, secondMin) <= Math.min(firstMax, secondMax)) {
          nextPoints = [
            ...nextPoints.slice(0, index + 1),
            fourth,
            ...nextPoints.slice(index + 4),
          ];
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      nextPoints = simplifyWaypoints(nextPoints);
    }
  }
  const finalPoints = simplifyWaypoints(nextPoints);
  if (points.length >= 2 && finalPoints.length < 2) {
    return [points[0], points[points.length - 1]];
  }
  return finalPoints;
}

function expandedNodeBounds(node: BoardNode, padding: number) {
  return {
    left: node.x - padding,
    right: node.x + node.width + padding,
    top: node.y - padding,
    bottom: node.y + node.height + padding,
  };
}

function segmentCrossesBounds(start: BoardPoint, end: BoardPoint, bounds: ReturnType<typeof expandedNodeBounds>) {
  const epsilon = 0.1;
  if (start.x === end.x) {
    const x = start.x;
    if (x <= bounds.left + epsilon || x >= bounds.right - epsilon) return false;
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    return bottom > bounds.top + epsilon && top < bounds.bottom - epsilon;
  }
  if (start.y === end.y) {
    const y = start.y;
    if (y <= bounds.top + epsilon || y >= bounds.bottom - epsilon) return false;
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    return right > bounds.left + epsilon && left < bounds.right - epsilon;
  }
  return true;
}

function pathCrossesNodes(points: BoardPoint[], nodes: BoardNode[], padding: number) {
  const bounds = nodes.map((node) => expandedNodeBounds(node, padding));
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (bounds.some((item) => segmentCrossesBounds(start, end, item))) {
      return true;
    }
  }
  return false;
}

function pathLength(points: BoardPoint[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.abs(points[index].x - points[index - 1].x) + Math.abs(points[index].y - points[index - 1].y);
  }
  return length;
}

function routeBetweenConnectorStubs(startOut: BoardPoint, endOut: BoardPoint, fromNode: BoardNode, toNode: BoardNode, gap: number) {
  const leftX = Math.min(fromNode.x, toNode.x) - gap;
  const rightX = Math.max(fromNode.x + fromNode.width, toNode.x + toNode.width) + gap;
  const topY = Math.min(fromNode.y, toNode.y) - gap;
  const bottomY = Math.max(fromNode.y + fromNode.height, toNode.y + toNode.height) + gap;
  const candidates = [
    [startOut, { x: startOut.x, y: endOut.y }, endOut],
    [startOut, { x: endOut.x, y: startOut.y }, endOut],
    [startOut, { x: leftX, y: startOut.y }, { x: leftX, y: endOut.y }, endOut],
    [startOut, { x: rightX, y: startOut.y }, { x: rightX, y: endOut.y }, endOut],
    [startOut, { x: startOut.x, y: topY }, { x: endOut.x, y: topY }, endOut],
    [startOut, { x: startOut.x, y: bottomY }, { x: endOut.x, y: bottomY }, endOut],
  ].map(simplifyWaypoints);
  const valid = candidates.filter((points) => !pathCrossesNodes(points, [fromNode, toNode], 2));
  const pool = valid.length > 0 ? valid : candidates;
  return [...pool].sort((a, b) => pathLength(a) - pathLength(b))[0] ?? [startOut, endOut];
}

function defaultConnectorWaypointsForNodes(connector: BoardConnector, fromNode: BoardNode, toNode: BoardNode) {
  const start = anchorPoint(fromNode, connector.from.anchor);
  const end = anchorPoint(toNode, connector.to.anchor);
  if (connector.routingMode === "straight") return [];
  if (connector.routingMode === "polyline") {
    return defaultConnectorWaypoints(start, end, connector.from.anchor, connector.to.anchor, connector.routingMode);
  }

  const gap = 36;
  const startOut = outwardPoint(start, connector.from.anchor, gap);
  const endOut = outwardPoint(end, connector.to.anchor, gap);
  const fullPath = protectConnectorEndpointStubs(simplifyOrthogonalPath([
    start,
    ...routeBetweenConnectorStubs(startOut, endOut, fromNode, toNode, gap),
    end,
  ]), connector.from.anchor, connector.to.anchor);
  return fullPath.slice(1, -1);
}

function isAxisAlignedPath(points: BoardPoint[]) {
  if (points.length < 2) return true;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous.x !== current.x && previous.y !== current.y) {
      return false;
    }
  }
  return true;
}

function connectorPoints(connector: BoardConnector, start: BoardPoint, end: BoardPoint) {
  if (connector.routingMode === "straight") return [start, end];
  const points = connector.waypoints.length > 0
    ? connector.waypoints
    : defaultConnectorWaypoints(start, end, connector.from.anchor, connector.to.anchor, connector.routingMode);
  const resolved = [start, ...points, end];
  if (!isAxisAlignedPath(resolved)) {
    return [start, ...defaultConnectorWaypoints(start, end, connector.from.anchor, connector.to.anchor, connector.routingMode), end];
  }
  return resolved;
}

function shouldUseAutoConnectorWaypoints(connector: BoardConnector) {
  return connector.routingMode === "orthogonal" || connector.routingMode === "rounded-orthogonal";
}

function roundedConnectorPath(points: BoardPoint[], radius: number) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const prevDistance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const nextDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.max(0, Math.min(radius, prevDistance / 2, nextDistance / 2));
    if (cornerRadius < 1) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }
    const startCorner = {
      x: current.x + ((previous.x - current.x) / prevDistance) * cornerRadius,
      y: current.y + ((previous.y - current.y) / prevDistance) * cornerRadius,
    };
    const endCorner = {
      x: current.x + ((next.x - current.x) / nextDistance) * cornerRadius,
      y: current.y + ((next.y - current.y) / nextDistance) * cornerRadius,
    };
    path += ` L ${startCorner.x} ${startCorner.y} Q ${current.x} ${current.y} ${endCorner.x} ${endCorner.y}`;
  }
  const last = points.at(-1);
  if (last) {
    path += ` L ${last.x} ${last.y}`;
  }
  return path;
}

function connectorPath(points: BoardPoint[], connector: BoardConnector) {
  if (points.length < 2) return "";
  if (connector.routingMode === "rounded-orthogonal") {
    return roundedConnectorPath(points, connector.style.cornerRadius ?? DEFAULT_CONNECTOR_STYLE.cornerRadius);
  }
  return `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`;
}

function connectorRoutingLabel(routingMode: ConnectorRoutingMode) {
  if (routingMode === "straight") return "直线";
  if (routingMode === "polyline") return "多段";
  if (routingMode === "rounded-orthogonal") return "圆角";
  return "折线";
}

function connectorSegmentHandles(points: BoardPoint[]) {
  if (points.length < 3) return [];
  const handles: Array<{
    segmentIndex: number;
    orientation: "horizontal" | "vertical";
    x: number;
    y: number;
    start: BoardPoint;
    end: BoardPoint;
  }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (start.x === end.x && start.y === end.y) continue;
    const orientation: "horizontal" | "vertical" = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical";
    handles.push({
      segmentIndex: index,
      orientation,
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      start,
      end,
    });
  }
  return handles;
}

function snapConnectorSegmentCoordinate(
  points: BoardPoint[],
  segmentIndex: number,
  orientation: "horizontal" | "vertical",
  coordinate: number,
) {
  const snapDistance = 8;
  let snapped = coordinate;
  let bestDistance = snapDistance + 1;
  for (const point of points) {
    const target = orientation === "horizontal" ? point.y : point.x;
    const distance = Math.abs(target - coordinate);
    if (distance <= snapDistance && distance < bestDistance) {
      snapped = target;
      bestDistance = distance;
    }
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    if (index === segmentIndex || Math.abs(index - segmentIndex) === 1) continue;
    const start = points[index];
    const end = points[index + 1];
    if (orientation === "horizontal" && start.y === end.y) {
      const distance = Math.abs(start.y - coordinate);
      if (distance <= snapDistance && distance < bestDistance) {
        snapped = start.y;
        bestDistance = distance;
      }
    }
    if (orientation === "vertical" && start.x === end.x) {
      const distance = Math.abs(start.x - coordinate);
      if (distance <= snapDistance && distance < bestDistance) {
        snapped = start.x;
        bestDistance = distance;
      }
    }
  }
  return snapped;
}

function moveConnectorSegment(points: BoardPoint[], segmentIndex: number, orientation: "horizontal" | "vertical", point: BoardPoint) {
  const nextPoints = points.map((item) => ({ ...item }));
  const lastIndex = nextPoints.length - 1;
  if (lastIndex < 1 || segmentIndex < 0 || segmentIndex >= lastIndex) return nextPoints;

  const startIndex = segmentIndex;
  const endIndex = segmentIndex + 1;
  if (orientation === "horizontal") {
    const y = snapConnectorSegmentCoordinate(points, segmentIndex, orientation, point.y);
    if (startIndex === 0) {
      nextPoints[endIndex].y = y;
      nextPoints.splice(1, 0, { x: nextPoints[0].x, y });
    } else if (endIndex === lastIndex) {
      nextPoints[startIndex].y = y;
      nextPoints.splice(endIndex, 0, { x: nextPoints[lastIndex].x, y });
    } else {
      nextPoints[startIndex].y = y;
      nextPoints[endIndex].y = y;
    }
  } else if (startIndex === 0) {
    const x = snapConnectorSegmentCoordinate(points, segmentIndex, orientation, point.x);
    nextPoints[endIndex].x = x;
    nextPoints.splice(1, 0, { x, y: nextPoints[0].y });
  } else if (endIndex === lastIndex) {
    const x = snapConnectorSegmentCoordinate(points, segmentIndex, orientation, point.x);
    nextPoints[startIndex].x = x;
    nextPoints.splice(endIndex, 0, { x, y: nextPoints[lastIndex].y });
  } else {
    const x = snapConnectorSegmentCoordinate(points, segmentIndex, orientation, point.x);
    nextPoints[startIndex].x = x;
    nextPoints[endIndex].x = x;
  }
  return simplifyOrthogonalPath(nextPoints);
}

function moveConnectorSegmentForConnector(
  connector: BoardConnector,
  points: BoardPoint[],
  segmentIndex: number,
  orientation: "horizontal" | "vertical",
  point: BoardPoint,
) {
  return protectConnectorEndpointStubs(
    moveConnectorSegment(points, segmentIndex, orientation, point),
    connector.from.anchor,
    connector.to.anchor,
  );
}

function connectorGeometry(connector: BoardConnector, nodes: BoardNode[]) {
  const fromNode = nodes.find((node) => node.id === connector.from.nodeId);
  const toNode = nodes.find((node) => node.id === connector.to.nodeId);
  if (!fromNode || !toNode) return null;
  const start = anchorPoint(fromNode, connector.from.anchor);
  const end = anchorPoint(toNode, connector.to.anchor);
  const resolvedWaypoints = connector.routingMode === "straight"
    ? []
    : shouldUseAutoConnectorWaypoints(connector)
      ? defaultConnectorWaypointsForNodes(connector, fromNode, toNode)
      : connector.waypoints.length > 0
        ? connector.waypoints
        : defaultConnectorWaypointsForNodes(connector, fromNode, toNode);
  const points = connector.routingMode === "straight" ? [start, end] : [start, ...resolvedWaypoints, end];
  const normalizedPoints = simplifyOrthogonalPath(points);
  const safePoints = isAxisAlignedPath(normalizedPoints)
    ? connector.routingMode === "straight" ? normalizedPoints : protectConnectorEndpointStubs(normalizedPoints, connector.from.anchor, connector.to.anchor)
    : simplifyOrthogonalPath([start, ...defaultConnectorWaypointsForNodes(connector, fromNode, toNode), end]);
  return {
    start,
    end,
    points: safePoints,
    path: connectorPath(safePoints, connector),
  };
}

function segmentPointAt(start: BoardPoint, end: BoardPoint, t: number) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function nearestPointOnConnector(points: BoardPoint[], target: BoardPoint) {
  let closest: { point: BoardPoint; segmentIndex: number; t: number; distance: number } | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const t = Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared));
    const point = segmentPointAt(start, end, t);
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (!closest || distance < closest.distance) {
      closest = { point, segmentIndex: index, t, distance };
    }
  }
  return closest ?? { point: target, segmentIndex: 0, t: 0.5, distance: 0 };
}

function connectorMidpoint(points: BoardPoint[]) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const totalLength = pathLength(points);
  if (totalLength <= 0) return points[Math.floor(points.length / 2)];
  let walked = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (walked + segmentLength >= totalLength / 2) {
      const t = segmentLength === 0 ? 0 : (totalLength / 2 - walked) / segmentLength;
      return segmentPointAt(start, end, t);
    }
    walked += segmentLength;
  }
  return points[points.length - 1];
}

function connectorLabelPoint(connector: BoardConnector, points: BoardPoint[]) {
  const segmentIndex = connector.labelSegmentIndex;
  const segmentT = typeof connector.labelSegmentT === "number" ? Math.max(0, Math.min(1, connector.labelSegmentT)) : undefined;
  if (
    typeof segmentIndex === "number"
    && typeof segmentT === "number"
    && segmentIndex >= 0
    && segmentIndex < points.length - 1
  ) {
    return segmentPointAt(points[segmentIndex], points[segmentIndex + 1], segmentT);
  }
  return connector.labelPosition ?? connectorMidpoint(points);
}

function rerouteConnectorForNodes(connector: BoardConnector, nodes: BoardNode[]) {
  const fromNode = nodes.find((node) => node.id === connector.from.nodeId);
  const toNode = nodes.find((node) => node.id === connector.to.nodeId);
  if (!fromNode || !toNode) return connector;
  return {
    ...connector,
    waypoints: defaultConnectorWaypointsForNodes(connector, fromNode, toNode),
  };
}

function adaptConnectorsForMovedNodes(
  connectors: BoardConnector[],
  nodes: BoardNode[],
  movedNodeIds: string[],
  translatedConnectorWaypoints: Record<string, BoardWaypoint[]> = {},
) {
  const moved = new Set(movedNodeIds);
  return connectors.map((connector) => {
    const translatedWaypoints = translatedConnectorWaypoints[connector.id];
    const fromMoved = moved.has(connector.from.nodeId);
    const toMoved = moved.has(connector.to.nodeId);
    if (translatedWaypoints && fromMoved && toMoved) {
      return { ...connector, waypoints: translatedWaypoints };
    }
    if (translatedWaypoints && !fromMoved && !toMoved) {
      return { ...connector, waypoints: translatedWaypoints };
    }
    if (fromMoved || toMoved) {
      return rerouteConnectorForNodes(connector, nodes);
    }
    return connector;
  });
}

function normalizeBoardAutoConnectors(boardState: BoardState) {
  return {
    ...boardState,
    connectors: boardState.connectors.map((connector) => {
      if (!shouldUseAutoConnectorWaypoints(connector)) return connector;
      const fromNode = boardState.nodes.find((node) => node.id === connector.from.nodeId);
      const toNode = boardState.nodes.find((node) => node.id === connector.to.nodeId);
      if (!fromNode || !toNode) return connector;
      return {
        ...connector,
        waypoints: defaultConnectorWaypointsForNodes(connector, fromNode, toNode),
      };
    }),
  };
}

function nearestAnchor(
  point: BoardPoint,
  nodes: BoardNode[],
  isAllowed: (endpoint: ConnectorEndpoint) => boolean = () => true,
  maxDistance = 18,
) {
  let closest: { endpoint: ConnectorEndpoint; distance: number } | null = null;
  for (const node of nodes) {
    for (const anchor of ANCHORS) {
      const endpoint = { nodeId: node.id, anchor };
      if (!isAllowed(endpoint)) continue;
      const anchorPosition = anchorPoint(node, anchor);
      const distance = Math.hypot(anchorPosition.x - point.x, anchorPosition.y - point.y);
      if (distance <= maxDistance && (!closest || distance < closest.distance)) {
        closest = { endpoint, distance };
      }
    }
  }
  return closest?.endpoint ?? null;
}

function nearestAnchorOnNode(point: BoardPoint, node: BoardNode): BoardAnchor {
  let closest: { anchor: BoardAnchor; distance: number } | null = null;
  for (const anchor of ANCHORS) {
    const anchorPosition = anchorPoint(node, anchor);
    const distance = Math.hypot(anchorPosition.x - point.x, anchorPosition.y - point.y);
    if (!closest || distance < closest.distance) {
      closest = { anchor, distance };
    }
  }
  return closest?.anchor ?? "left";
}

function pointInExpandedNode(point: BoardPoint, node: BoardNode, padding = 10) {
  return point.x >= node.x - padding
    && point.x <= node.x + node.width + padding
    && point.y >= node.y - padding
    && point.y <= node.y + node.height + padding;
}

function nearestConnectableAnchor(
  point: BoardPoint,
  nodes: BoardNode[],
  source: ConnectorEndpoint,
  maxDistance = 38,
): ConnectorEndpoint | null {
  const directAnchor = nearestAnchor(
    point,
    nodes,
    (endpoint) => endpoint.nodeId !== source.nodeId,
    maxDistance,
  );
  if (directAnchor) return directAnchor;

  let closestNode: { node: BoardNode; distance: number } | null = null;
  for (const node of nodes) {
    if (node.id === source.nodeId || !pointInExpandedNode(point, node)) continue;
    const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    const distance = Math.hypot(center.x - point.x, center.y - point.y);
    if (!closestNode || distance < closestNode.distance) {
      closestNode = { node, distance };
    }
  }
  if (!closestNode) return null;
  return { nodeId: closestNode.node.id, anchor: nearestAnchorOnNode(point, closestNode.node) };
}

function boardTextCharWeight(char: string) {
  if (/\s/.test(char)) return 0.35;
  if (/[\u0000-\u007f]/.test(char)) return 0.56;
  if (/[\u3000-\u303f\uff00-\uffef]/.test(char)) return 0.75;
  return 1;
}

function wrapText(text: string, maxUnits: number) {
  const lines: string[] = [];
  for (const rawLine of (text || "").split("\n")) {
    if (!rawLine) {
      lines.push("");
      continue;
    }
    let line = "";
    let lineUnits = 0;
    for (const char of rawLine) {
      const charUnits = boardTextCharWeight(char);
      if (line && lineUnits + charUnits > maxUnits) {
        lines.push(line);
        line = char;
        lineUnits = charUnits;
        continue;
      }
      line += char;
      lineUnits += charUnits;
    }
    lines.push(line);
  }
  return lines;
}

function normalizeRect(start: BoardPoint, current: BoardPoint): BoardRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function rectsIntersect(a: BoardRect, b: BoardRect) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function isMeaningfulSelectionRect(rect: BoardRect) {
  return rect.width >= 6 || rect.height >= 6;
}

function nodeRect(node: BoardNode): BoardRect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

function connectorBounds(connector: BoardConnector, nodes: BoardNode[]): BoardRect | null {
  const geometry = connectorGeometry(connector, nodes);
  if (!geometry) return null;
  const xs = geometry.points.map((point) => point.x);
  const ys = geometry.points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function combineBounds(rects: BoardRect[]): BoardRect | null {
  if (rects.length === 0) return null;
  return {
    x: Math.min(...rects.map((rect) => rect.x)),
    y: Math.min(...rects.map((rect) => rect.y)),
    width: Math.max(...rects.map((rect) => rect.x + rect.width)) - Math.min(...rects.map((rect) => rect.x)),
    height: Math.max(...rects.map((rect) => rect.y + rect.height)) - Math.min(...rects.map((rect) => rect.y)),
  };
}

export function BoardDocumentPage({
  document,
  breadcrumbs,
  spaceName,
}: {
  document: DocumentViewModel;
  breadcrumbs?: AncestorItem[];
  spaceName?: string;
}) {
  const router = useRouter();
  const [currentDocument, setCurrentDocument] = useState(document);
  const [board, setBoard] = useState(() => normalizeBoardState(document.contentJson));
  const [tool, setTool] = useState<BoardTool>("select");
  const [pendingShape, setPendingShape] = useState<BoardNodeType>("rectangle");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);
  const [multiSelectionFilter, setMultiSelectionFilter] = useState<MultiSelectionFilter>("all");
  const [selectionRect, setSelectionRect] = useState<SelectionRectState | null>(null);
  const [quickAddPreview, setQuickAddPreview] = useState<QuickAddPreviewState | null>(null);
  const [shapePlacementPreview, setShapePlacementPreview] = useState<ShapePlacementPreviewState | null>(null);
  const [activePanel, setActivePanel] = useState<ToolbarPanel>(null);
  const [shapePaletteOpen, setShapePaletteOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingConnectorLabel, setEditingConnectorLabel] = useState<{
    connectorId: string;
    position: BoardPoint;
    segmentIndex: number;
    segmentT: number;
  } | null>(null);
  const [editingConnectorLabelText, setEditingConnectorLabelText] = useState("");
  const [dragState, setDragState] = useState<{
    nodeIds: string[];
    connectorIds: string[];
    startX: number;
    startY: number;
    nodePositions: Record<string, { x: number; y: number }>;
    connectorWaypoints: Record<string, BoardWaypoint[]>;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{ nodeId: string; handle: ResizeHandle; startX: number; startY: number; node: BoardNode } | null>(null);
  const [connectorHandleDrag, setConnectorHandleDrag] = useState<{
    connectorId: string;
    segmentIndex: number;
    orientation: "horizontal" | "vertical";
    points: BoardPoint[];
  } | null>(null);
  const [connectorPointDrag, setConnectorPointDrag] = useState<{
    connectorId: string;
    pointIndex: number;
    points: BoardPoint[];
  } | null>(null);
  const [connectorEndpointDrag, setConnectorEndpointDrag] = useState<{
    connectorId: string;
    endpoint: "from" | "to";
    pointer: BoardPoint;
  } | null>(null);
  const [connectorLabelDrag, setConnectorLabelDrag] = useState<{ connectorId: string } | null>(null);
  const [panState, setPanState] = useState<{ startX: number; startY: number; viewportX: number; viewportY: number } | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<{ from: ConnectorEndpoint; pointer: { x: number; y: number } } | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<ConnectorEndpoint | null>(null);
  const [clipboardNode, setClipboardNode] = useState<BoardNode | null>(null);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isTransientToolbarHidden, setIsTransientToolbarHidden] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [history, setHistory] = useState<{ past: BoardSnapshot[]; future: BoardSnapshot[] }>({ past: [], future: [] });
  const [isMutating, startTransition] = useTransition();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const connectorLabelInputRef = useRef<HTMLInputElement | null>(null);
  const connectorClickRef = useRef<{ connectorId: string; at: number } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const shapeHoverTimerRef = useRef<number | null>(null);
  const panelHoverTimerRef = useRef<number | null>(null);
  const dragToolbarTimerRef = useRef<number | null>(null);
  const quickAddPressTimerRef = useRef<number | null>(null);
  const quickAddPressRef = useRef<QuickAddPressState | null>(null);
  const quickAddSuppressClickRef = useRef(false);
  const connectorSourceRef = useRef<ConnectorEndpoint | null>(null);
  const interactionStartSnapshotRef = useRef<BoardSnapshot | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const toolRef = useRef<BoardTool>("select");
  const canEdit = currentDocument.canEdit && !currentDocument.isSharedView;
  const canDelete = currentDocument.canDelete && !currentDocument.isSharedView;
  const selectedNode = selectedNodeId ? board.nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const selectedConnector = selectedConnectorId ? board.connectors.find((connector) => connector.id === selectedConnectorId) ?? null : null;
  const multiSelectedNodes = useMemo(() => board.nodes.filter((node) => selectedNodeIds.includes(node.id)), [board.nodes, selectedNodeIds]);
  const multiSelectedConnectors = useMemo(() => board.connectors.filter((connector) => selectedConnectorIds.includes(connector.id)), [board.connectors, selectedConnectorIds]);
  const isMultiSelect = selectedNodeIds.length + selectedConnectorIds.length > 1;
  const activeMultiSelectedNodes = useMemo(() => {
    if (!isMultiSelect) return [];
    if (multiSelectionFilter === "all") return multiSelectedNodes;
    if (multiSelectionFilter === "connector") return [];
    const targetType = multiSelectionFilter.replace("node:", "") as BoardNodeType;
    return multiSelectedNodes.filter((node) => node.type === targetType);
  }, [isMultiSelect, multiSelectionFilter, multiSelectedNodes]);
  const activeMultiSelectedConnectors = useMemo(() => {
    if (!isMultiSelect) return [];
    return multiSelectionFilter === "all" || multiSelectionFilter === "connector" ? multiSelectedConnectors : [];
  }, [isMultiSelect, multiSelectionFilter, multiSelectedConnectors]);
  const activeMultiSelectionBounds = useMemo(() => {
    if (!isMultiSelect) return null;
    const rects: BoardRect[] = [];
    activeMultiSelectedNodes.forEach((node) => rects.push(nodeRect(node)));
    activeMultiSelectedConnectors.forEach((connector) => {
      const bounds = connectorBounds(connector, board.nodes);
      if (bounds) rects.push(bounds);
    });
    return combineBounds(rects);
  }, [activeMultiSelectedConnectors, activeMultiSelectedNodes, board.nodes, isMultiSelect]);
  const multiSelectionOptions = useMemo<MultiSelectionOption[]>(() => {
    if (!isMultiSelect) return [];
    const options: MultiSelectionOption[] = [];
    const total = selectedNodeIds.length + selectedConnectorIds.length;
    options.push({ key: "all", label: "所有元素", count: total });
    const counts = new Map<BoardNodeType, number>();
    multiSelectedNodes.forEach((node) => counts.set(node.type, (counts.get(node.type) ?? 0) + 1));
    for (const [type, count] of counts.entries()) {
      options.push({ key: `node:${type}`, label: nodeLabel(type), count });
    }
    if (selectedConnectorIds.length > 0) {
      options.push({ key: "connector", label: "连线", count: selectedConnectorIds.length });
    }
    return options;
  }, [isMultiSelect, multiSelectedNodes, selectedConnectorIds.length, selectedNodeIds.length]);
  const fallbackUrl = useMemo(
    () =>
      breadcrumbs && breadcrumbs.length > 0
        ? `/folders/${breadcrumbs[breadcrumbs.length - 1].id}`
        : `/documents${currentDocument.spaceId ? `?space=${currentDocument.spaceId}` : ""}`,
    [breadcrumbs, currentDocument.spaceId],
  );

  useEffect(() => {
    setCurrentDocument(document);
    setBoard(normalizeBoardState(document.contentJson));
    setSelectedNodeId(null);
    setSelectedConnectorId(null);
    setSelectedNodeIds([]);
    setSelectedConnectorIds([]);
    setMultiSelectionFilter("all");
    setSelectionRect(null);
    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    setActivePanel(null);
    setConnectionDrag(null);
    setConnectorEndpointDrag(null);
    setConnectorLabelDrag(null);
    setHoveredAnchor(null);
    setEditingConnectorLabel(null);
    setEditingConnectorLabelText("");
    setFloatingToolbarDomHidden(false);
    setIsTransientToolbarHidden(false);
    setIsDirty(false);
    setHistory({ past: [], future: [] });
    setNotice("");
    interactionStartSnapshotRef.current = null;
  }, [document]);

  useEffect(() => {
    if (!editingNodeId) return;
    window.setTimeout(() => textAreaRef.current?.focus(), 0);
  }, [editingNodeId]);

  useEffect(() => {
    if (!editingConnectorLabel) return;
    window.setTimeout(() => {
      connectorLabelInputRef.current?.focus();
      connectorLabelInputRef.current?.select();
    }, 0);
  }, [editingConnectorLabel]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (shapeHoverTimerRef.current) window.clearTimeout(shapeHoverTimerRef.current);
    if (panelHoverTimerRef.current) window.clearTimeout(panelHoverTimerRef.current);
    if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
    if (quickAddPressTimerRef.current) window.clearTimeout(quickAddPressTimerRef.current);
  }, []);

  const commitBoard = (updater: (current: BoardState) => BoardState) => {
    if (!canEdit) return;
    setBoard((current) => {
      const next = updater(current);
      setHistory((historyState) => ({ past: [...historyState.past, cloneSnapshot(current)].slice(-80), future: [] }));
      setIsDirty(true);
      return { ...next, version: 2 };
    });
  };

  const beginContinuousInteraction = () => {
    if (!interactionStartSnapshotRef.current) {
      interactionStartSnapshotRef.current = cloneSnapshot(board);
    }
  };

  const saveBoard = async () => {
    if (!canEdit) return true;
    setIsSaving(true);
    try {
      const boardToSave = normalizeBoardAutoConnectors(board);
      const nextDocument = await updateDocumentContent({
        docId: currentDocument.id,
        contentJson: { ...boardToSave, version: 2 },
        plainText: currentDocument.title,
      });
      setBoard(boardToSave);
      setCurrentDocument(nextDocument);
      setIsDirty(false);
      setNotice("已保存");
      return true;
    } catch {
      setNotice("保存失败，请检查后端服务");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!canEdit || !isDirty) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveBoard();
    }, 1000);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [board, canEdit, isDirty]);

  const screenToBoard = (event: Pick<ReactPointerEvent<SVGElement> | ReactMouseEvent<SVGSVGElement>, "clientX" | "clientY">) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - board.viewport.x) / board.viewport.zoom,
      y: (event.clientY - rect.top - board.viewport.y) / board.viewport.zoom,
    };
  };

  const boardToScreen = (point: { x: number; y: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return {
      x: (rect?.left ?? 0) + board.viewport.x + point.x * board.viewport.zoom,
      y: (rect?.top ?? 0) + board.viewport.y + point.y * board.viewport.zoom,
    };
  };

  const addNodeAt = (type: BoardNodeType, x: number, y: number) => {
    const { width, height } = defaultNodeSize(type);
    let newId = "";
    commitBoard((current) => {
      newId = crypto.randomUUID();
      return {
        ...current,
        nodes: [
          ...current.nodes,
          {
            id: newId,
            type,
            x,
            y,
            width,
            height,
            text: defaultNodeText(type),
            manualSize: false,
            style: { ...DEFAULT_NODE_STYLE, fill: type === "text" ? "transparent" : DEFAULT_NODE_STYLE.fill },
            zIndex: Math.max(0, ...current.nodes.map((node) => node.zIndex)) + 1,
          },
        ],
      };
    });
    selectSingleNode(newId);
    setShapePlacementPreview(null);
    toolRef.current = "select";
    setTool("select");
  };

  const updateShapePlacementPreview = (event: ReactPointerEvent<SVGSVGElement>) => {
    const activeTool = toolRef.current;
    if (!canEdit || (activeTool !== "shape" && activeTool !== "text")) {
      setShapePlacementPreview((current) => current ? null : current);
      return;
    }
    const type = activeTool === "text" ? "text" : pendingShape;
    const { width, height } = defaultNodeSize(type);
    const point = screenToBoard(event);
    setQuickAddPreview(null);
    setShapePlacementPreview({
      type,
      width,
      height,
      x: point.x - width / 2,
      y: point.y - height / 2,
    });
  };

  const openShapePalette = () => {
    if (shapeHoverTimerRef.current) window.clearTimeout(shapeHoverTimerRef.current);
    setShapePaletteOpen(true);
  };

  const scheduleCloseShapePalette = () => {
    if (shapeHoverTimerRef.current) window.clearTimeout(shapeHoverTimerRef.current);
    shapeHoverTimerRef.current = window.setTimeout(() => {
      setShapePaletteOpen(false);
    }, 180);
  };

  const openToolbarPanel = (panel: Exclude<ToolbarPanel, null>) => {
    if (panelHoverTimerRef.current) window.clearTimeout(panelHoverTimerRef.current);
    setActivePanel(panel);
  };

  const scheduleCloseToolbarPanel = () => {
    if (panelHoverTimerRef.current) window.clearTimeout(panelHoverTimerRef.current);
    panelHoverTimerRef.current = window.setTimeout(() => {
      setActivePanel(null);
    }, 180);
  };

  const setFloatingToolbarDomHidden = (hidden: boolean) => {
    if (typeof globalThis.document === "undefined") return;
    globalThis.document.querySelectorAll<HTMLElement>(".board-floating-toolbar").forEach((element) => {
      element.style.display = hidden ? "none" : "";
    });
  };

  const hideToolbarDuringDrag = () => {
    if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
    setFloatingToolbarDomHidden(true);
    setIsTransientToolbarHidden(true);
    dragToolbarTimerRef.current = window.setTimeout(() => {
      setFloatingToolbarDomHidden(false);
      setIsTransientToolbarHidden(false);
    }, 1000);
  };

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedConnectorId(null);
    setSelectedNodeIds([]);
    setSelectedConnectorIds([]);
    setMultiSelectionFilter("all");
    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    setActivePanel(null);
    setEditingConnectorLabel(null);
    setEditingConnectorLabelText("");
  };

  const selectSingleNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedConnectorId(null);
    setSelectedNodeIds([]);
    setSelectedConnectorIds([]);
    setMultiSelectionFilter("all");
    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    setActivePanel(null);
    setEditingConnectorLabel(null);
    setEditingConnectorLabelText("");
  };

  const selectSingleConnector = (connectorId: string) => {
    setSelectedNodeId(null);
    setSelectedConnectorId(connectorId);
    setSelectedNodeIds([]);
    setSelectedConnectorIds([]);
    setMultiSelectionFilter("all");
    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    setActivePanel(null);
    if (editingConnectorLabel?.connectorId !== connectorId) {
      setEditingConnectorLabel(null);
      setEditingConnectorLabelText("");
    }
  };

  const applySelectionResult = (nodeIds: string[], connectorIds: string[]) => {
    const total = nodeIds.length + connectorIds.length;
    if (total <= 0) {
      clearSelection();
      return;
    }
    if (total === 1) {
      if (nodeIds.length === 1) {
        selectSingleNode(nodeIds[0]);
        return;
      }
      if (connectorIds.length === 1) {
        selectSingleConnector(connectorIds[0]);
        return;
      }
    }
    setSelectedNodeId(null);
    setSelectedConnectorId(null);
    setSelectedNodeIds(nodeIds);
    setSelectedConnectorIds(connectorIds);
    setMultiSelectionFilter("all");
    setActivePanel(null);
  };

  const updateSelectedStyle = (patch: Partial<BoardNode["style"]>) => {
    if (!selectedNode) return;
    commitBoard((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, style: { ...node.style, ...patch } } : node,
      ),
    }));
  };

  const updateSelectedConnector = (patch: Omit<Partial<BoardConnector>, "style"> & { style?: Partial<BoardConnector["style"]> }) => {
    if (!selectedConnector) return;
    commitBoard((current) => ({
      ...current,
      connectors: current.connectors.map((connector) =>
        connector.id === selectedConnector.id
          ? { ...connector, ...patch, style: { ...connector.style, ...(patch.style || {}) } }
          : connector,
      ),
    }));
  };

  const startConnectorLabelEditing = (connector: BoardConnector, point: BoardPoint) => {
    if (!canEdit) return;
    const geometry = connectorGeometry(connector, board.nodes);
    if (!geometry) return;
    const anchor = nearestPointOnConnector(geometry.points, point);
    setSelectedConnectorId(connector.id);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedConnectorIds([]);
    setActivePanel(null);
    setEditingConnectorLabel({
      connectorId: connector.id,
      position: anchor.point,
      segmentIndex: anchor.segmentIndex,
      segmentT: anchor.t,
    });
    setEditingConnectorLabelText(connector.label || "");
  };

  const startConnectorLabelDrag = (event: ReactPointerEvent<HTMLElement>, connector: BoardConnector) => {
    if (!canEdit) return;
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      startCanvasPan(event);
      return;
    }
    if (event.button !== 0 || event.detail >= 2) return;
    event.preventDefault();
    event.stopPropagation();
    beginContinuousInteraction();
    hideToolbarDuringDrag();
    setSelectedConnectorId(connector.id);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedConnectorIds([]);
    setMultiSelectionFilter("all");
    setActivePanel(null);
    setEditingConnectorLabel(null);
    setEditingConnectorLabelText("");
    setConnectorLabelDrag({ connectorId: connector.id });
  };

  const finishConnectorLabelEditing = () => {
    if (!editingConnectorLabel) return;
    const target = editingConnectorLabel;
    const label = editingConnectorLabelText.trim();
    commitBoard((current) => ({
      ...current,
      connectors: current.connectors.map((connector) => {
        if (connector.id !== target.connectorId) return connector;
        if (!label) {
          const { labelPosition: _labelPosition, labelSegmentIndex: _labelSegmentIndex, labelSegmentT: _labelSegmentT, ...rest } = connector;
          return { ...rest, label: "" };
        }
        return {
          ...connector,
          label,
          labelPosition: target.position,
          labelSegmentIndex: target.segmentIndex,
          labelSegmentT: target.segmentT,
        };
      }),
    }));
    setEditingConnectorLabel(null);
    setEditingConnectorLabelText("");
  };

  const buildConnector = (nodes: BoardNode[], from: ConnectorEndpoint, to: ConnectorEndpoint, routingMode: ConnectorRoutingMode = "rounded-orthogonal"): BoardConnector => {
    const fromNode = nodes.find((node) => node.id === from.nodeId);
    const toNode = nodes.find((node) => node.id === to.nodeId);
    const nextConnector: BoardConnector = {
      id: crypto.randomUUID(),
      from,
      to,
      routingMode,
      waypoints: [],
      label: "",
      style: { ...DEFAULT_CONNECTOR_STYLE, cornerRadius: routingMode === "rounded-orthogonal" ? 12 : 0 },
      zIndex: 0,
    };
    return {
      ...nextConnector,
      waypoints: fromNode && toNode ? defaultConnectorWaypointsForNodes(nextConnector, fromNode, toNode) : [],
    };
  };

  const buildQuickAddPreviewNode = (source: BoardNode, anchor: BoardAnchor): BoardNode => {
    const width = source.width;
    const height = source.height;
    const position = quickAddNodePosition(source, anchor, width, height);
    return {
      ...structuredClone(source),
      id: "quick-add-preview",
      x: position.x,
      y: position.y,
      width,
      height,
      text: defaultNodeText(source.type),
      manualSize: false,
      style: { ...source.style },
      zIndex: source.zIndex + 1,
    };
  };

  const createQuickAddNode = (source: BoardNode, anchor: BoardAnchor) => {
    if (!canEdit) return;
    const newNodeId = crypto.randomUUID();
    commitBoard((current) => {
      const currentSource = current.nodes.find((node) => node.id === source.id);
      if (!currentSource) return current;
      const width = currentSource.width;
      const height = currentSource.height;
      const position = quickAddNodePosition(currentSource, anchor, width, height);
      const nextNode: BoardNode = {
        ...structuredClone(currentSource),
        id: newNodeId,
        x: position.x,
        y: position.y,
        width,
        height,
        text: defaultNodeText(currentSource.type),
        manualSize: false,
        style: { ...currentSource.style },
        zIndex: Math.max(0, ...current.nodes.map((node) => node.zIndex)) + 1,
      };
      const nodes = [...current.nodes, nextNode];
      const connector = buildConnector(
        nodes,
        { nodeId: currentSource.id, anchor },
        { nodeId: nextNode.id, anchor: oppositeAnchor(anchor) },
        "rounded-orthogonal",
      );
      return {
        ...current,
        nodes,
        connectors: [...current.connectors, connector],
      };
    });
    setQuickAddPreview(null);
    selectSingleNode(newNodeId);
    toolRef.current = "select";
    setTool("select");
  };

  const clearQuickAddPressTimer = () => {
    if (!quickAddPressTimerRef.current) return;
    window.clearTimeout(quickAddPressTimerRef.current);
    quickAddPressTimerRef.current = null;
  };

  const beginQuickAddConnectionFromPress = () => {
    const press = quickAddPressRef.current;
    if (!canEdit || !press || press.startedConnection) return;
    press.startedConnection = true;
    quickAddPressRef.current = press;
    quickAddSuppressClickRef.current = true;
    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    hideToolbarDuringDrag();
    connectorSourceRef.current = null;
    const from = { nodeId: press.sourceNodeId, anchor: press.anchor };
    setConnectionDrag({
      from,
      pointer: screenToBoard({ clientX: press.latestClientX, clientY: press.latestClientY }),
    });
    selectSingleNode(press.sourceNodeId);
    toolRef.current = "connector";
    setTool("connector");
  };

  const finishConnectionDragAtPoint = (activeConnectionDrag: { from: ConnectorEndpoint; pointer: BoardPoint }, releasePoint: BoardPoint) => {
    const target = nearestConnectableAnchor(releasePoint, board.nodes, activeConnectionDrag.from, 42) ?? hoveredAnchor;
    if (target && target.nodeId !== activeConnectionDrag.from.nodeId) {
      let connectorId = "";
      commitBoard((current) => ({
        ...current,
        connectors: [
          ...current.connectors,
          (() => {
            const connector = buildConnector(current.nodes, activeConnectionDrag.from, target, "rounded-orthogonal");
            connectorId = connector.id;
            return connector;
          })(),
        ],
      }));
      if (connectorId) {
        selectSingleConnector(connectorId);
      }
    }
    connectorSourceRef.current = null;
    setConnectionDrag(null);
    setHoveredAnchor(null);
    toolRef.current = "select";
    setTool("select");
    if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
    setFloatingToolbarDomHidden(false);
    setIsTransientToolbarHidden(false);
  };

  const handleQuickAddPointerDown = (event: ReactPointerEvent<SVGGElement>, node: BoardNode, anchor: BoardAnchor) => {
    if (!canEdit) return;
    if (event.button === 1) {
      event.stopPropagation();
      event.preventDefault();
      startCanvasPan(event);
      return;
    }
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    quickAddSuppressClickRef.current = false;
    quickAddPressRef.current = {
      sourceNodeId: node.id,
      anchor,
      startClientX: event.clientX,
      startClientY: event.clientY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      startedConnection: false,
    };
    clearQuickAddPressTimer();
    quickAddPressTimerRef.current = window.setTimeout(() => {
      quickAddPressTimerRef.current = null;
      beginQuickAddConnectionFromPress();
    }, 220);
  };

  const handleQuickAddPointerMove = (event: ReactPointerEvent<SVGGElement>, node: BoardNode, anchor: BoardAnchor) => {
    const press = quickAddPressRef.current;
    if (!press || press.sourceNodeId !== node.id || press.anchor !== anchor) return;
    press.latestClientX = event.clientX;
    press.latestClientY = event.clientY;
    quickAddPressRef.current = press;
    const moved = Math.hypot(event.clientX - press.startClientX, event.clientY - press.startClientY);
    if (!press.startedConnection && moved > 6) {
      clearQuickAddPressTimer();
      beginQuickAddConnectionFromPress();
    }
    if (press.startedConnection) {
      const point = screenToBoard(event);
      const from = { nodeId: node.id, anchor };
      const target = nearestConnectableAnchor(point, board.nodes, from, 42);
      const targetNode = target ? board.nodes.find((item) => item.id === target.nodeId) : null;
      setHoveredAnchor(target);
      setConnectionDrag({
        from,
        pointer: target && targetNode ? anchorPoint(targetNode, target.anchor) : point,
      });
    }
  };

  const handleQuickAddPointerLeave = (event: ReactPointerEvent<SVGGElement>, node: BoardNode, anchor: BoardAnchor) => {
    const press = quickAddPressRef.current;
    if (press?.sourceNodeId === node.id && press.anchor === anchor && event.buttons === 1 && !press.startedConnection) {
      clearQuickAddPressTimer();
      beginQuickAddConnectionFromPress();
      return;
    }
    setQuickAddPreview((current) => current?.sourceNodeId === node.id && current.anchor === anchor ? null : current);
  };

  const handleQuickAddPointerUp = (event: ReactPointerEvent<SVGGElement>, node: BoardNode, anchor: BoardAnchor) => {
    const press = quickAddPressRef.current;
    if (!press || press.sourceNodeId !== node.id || press.anchor !== anchor) return;
    clearQuickAddPressTimer();
    if (press.startedConnection) {
      event.stopPropagation();
      event.preventDefault();
      quickAddSuppressClickRef.current = true;
      finishConnectionDragAtPoint(
        { from: { nodeId: node.id, anchor }, pointer: screenToBoard(event) },
        screenToBoard(event),
      );
    } else {
      event.stopPropagation();
      event.preventDefault();
      quickAddSuppressClickRef.current = true;
      createQuickAddNode(node, anchor);
    }
    quickAddPressRef.current = null;
  };

  const handleQuickAddClick = (event: ReactMouseEvent<SVGGElement>, node: BoardNode, anchor: BoardAnchor) => {
    event.stopPropagation();
    if (quickAddSuppressClickRef.current) {
      quickAddSuppressClickRef.current = false;
      return;
    }
    createQuickAddNode(node, anchor);
  };

  const applyConnectorRouting = (connector: BoardConnector, routingMode: ConnectorRoutingMode, nodes: BoardNode[]) => {
    const fromNode = nodes.find((node) => node.id === connector.from.nodeId);
    const toNode = nodes.find((node) => node.id === connector.to.nodeId);
    if (!fromNode || !toNode) {
      return { ...connector, routingMode, waypoints: [], style: { ...connector.style, cornerRadius: routingMode === "rounded-orthogonal" ? 12 : 0 } };
    }
    const nextConnector = {
      ...connector,
      routingMode,
      waypoints: [],
      style: {
        ...connector.style,
        cornerRadius: routingMode === "rounded-orthogonal"
          ? Math.max(8, connector.style.cornerRadius ?? DEFAULT_CONNECTOR_STYLE.cornerRadius)
          : 0,
      },
    };
    return {
      ...nextConnector,
      waypoints: defaultConnectorWaypointsForNodes(nextConnector, fromNode, toNode),
    };
  };

  const setSelectedConnectorRouting = (routingMode: ConnectorRoutingMode) => {
    if (!selectedConnector) return;
    commitBoard((current) => ({
      ...current,
      connectors: current.connectors.map((connector) =>
        connector.id === selectedConnector.id ? applyConnectorRouting(connector, routingMode, current.nodes) : connector,
      ),
    }));
  };

  const deleteSelected = () => {
    const targetNodeIds = isMultiSelect ? activeMultiSelectedNodes.map((node) => node.id) : selectedNodeId ? [selectedNodeId] : [];
    const targetConnectorIds = isMultiSelect ? activeMultiSelectedConnectors.map((connector) => connector.id) : selectedConnectorId ? [selectedConnectorId] : [];
    if (targetNodeIds.length === 0 && targetConnectorIds.length === 0) return;
    commitBoard((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => !targetNodeIds.includes(node.id)),
      connectors: current.connectors.filter((connector) => {
        if (targetConnectorIds.includes(connector.id)) return false;
        if (targetNodeIds.includes(connector.from.nodeId)) return false;
        if (targetNodeIds.includes(connector.to.nodeId)) return false;
        return true;
      }),
    }));
    clearSelection();
  };

  const duplicateSelected = () => {
    const sourceNodes = isMultiSelect ? activeMultiSelectedNodes : selectedNode ? [selectedNode] : [];
    if (sourceNodes.length === 0) return;
    const sourceNodeIds = sourceNodes.map((node) => node.id);
    const sourceConnectors = isMultiSelect
      ? activeMultiSelectedConnectors.filter((connector) => sourceNodeIds.includes(connector.from.nodeId) && sourceNodeIds.includes(connector.to.nodeId))
      : [];
    const createdNodeIds: string[] = [];
    commitBoard((current) => {
      const idMap = new Map<string, string>();
      const nextNodes = sourceNodes.map((node) => {
        const newId = crypto.randomUUID();
        createdNodeIds.push(newId);
        idMap.set(node.id, newId);
        return {
          ...structuredClone(node),
          id: newId,
          x: node.x + 24,
          y: node.y + 24,
          zIndex: Math.max(0, ...current.nodes.map((item) => item.zIndex)) + 1 + createdNodeIds.length,
        };
      });
      const nextConnectors = sourceConnectors.map((connector) => ({
        ...structuredClone(connector),
        id: crypto.randomUUID(),
        from: { ...connector.from, nodeId: idMap.get(connector.from.nodeId) ?? connector.from.nodeId },
        to: { ...connector.to, nodeId: idMap.get(connector.to.nodeId) ?? connector.to.nodeId },
        waypoints: connector.waypoints.map((point) => ({ x: point.x + 24, y: point.y + 24 })),
      }));
      return {
        ...current,
        nodes: [...current.nodes, ...nextNodes],
        connectors: [...current.connectors, ...nextConnectors],
      };
    });
    applySelectionResult(createdNodeIds, []);
  };

  const moveLayer = (mode: "front" | "back" | "up" | "down") => {
    const targetNodeIds = isMultiSelect ? activeMultiSelectedNodes.map((node) => node.id) : selectedNode ? [selectedNode.id] : [];
    if (targetNodeIds.length === 0) return;
    commitBoard((current) => {
      const sorted = [...current.nodes].sort((a, b) => a.zIndex - b.zIndex);
      const selectedIds = new Set(targetNodeIds);
      if (mode === "front") {
        let z = Math.max(...sorted.map((node) => node.zIndex), 0);
        sorted.forEach((node) => {
          if (selectedIds.has(node.id)) {
            z += 1;
            node.zIndex = z;
          }
        });
      }
      if (mode === "back") {
        let z = Math.min(...sorted.map((node) => node.zIndex), 0) - targetNodeIds.length;
        sorted.forEach((node) => {
          if (selectedIds.has(node.id)) {
            node.zIndex = z;
            z += 1;
          }
        });
      }
      if (!isMultiSelect && (mode === "up" || mode === "down")) {
        const index = sorted.findIndex((node) => node.id === targetNodeIds[0]);
        if (index === -1) return current;
        if (mode === "up" && index < sorted.length - 1) {
          const next = sorted[index + 1];
          [sorted[index].zIndex, next.zIndex] = [next.zIndex, sorted[index].zIndex];
        }
        if (mode === "down" && index > 0) {
          const previous = sorted[index - 1];
          [sorted[index].zIndex, previous.zIndex] = [previous.zIndex, sorted[index].zIndex];
        }
      }
      const byId = new Map(sorted.map((node) => [node.id, node]));
      return { ...current, nodes: current.nodes.map((node) => byId.get(node.id) || node) };
    });
  };

  const undo = () => {
    if (!canEdit) return;
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      setBoard((boardState) => ({ ...boardState, nodes: previous.nodes, connectors: previous.connectors, viewport: previous.viewport }));
      setIsDirty(true);
      return { past: current.past.slice(0, -1), future: [cloneSnapshot(board), ...current.future].slice(0, 80) };
    });
  };

  const redo = () => {
    if (!canEdit) return;
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      setBoard((boardState) => ({ ...boardState, nodes: next.nodes, connectors: next.connectors, viewport: next.viewport }));
      setIsDirty(true);
      return { past: [...current.past, cloneSnapshot(board)].slice(-80), future: current.future.slice(1) };
    });
  };

  const finishTextEditing = () => {
    if (!editingNodeId) return;
    const targetId = editingNodeId;
    const text = editingText;
    commitBoard((current) => {
      const nodes = current.nodes.map((node) => {
        if (node.id !== targetId) return node;
        const nextNode = { ...node, text };
        return node.manualSize ? nextNode : fitNodeHeightToText(nextNode, text);
      });
      return {
        ...current,
        nodes,
        connectors: adaptConnectorsForMovedNodes(current.connectors, nodes, [targetId]),
      };
    });
    setEditingNodeId(null);
    setEditingText("");
  };

  const startTextEditing = (node: BoardNode) => {
    if (!canEdit) return;
    selectSingleNode(node.id);
    setEditingNodeId(node.id);
    setEditingText(node.text);
    setActivePanel(null);
  };

  const handleNodeClick = (node: BoardNode) => {
    if (isMultiSelect && activeMultiSelectedNodes.some((item) => item.id === node.id)) {
      return;
    }
    if (toolRef.current === "connector" && canEdit) {
      const source = connectorSourceRef.current || connectionDrag?.from || null;
      if (!source) {
        const from = { nodeId: node.id, anchor: "right" as BoardAnchor };
        connectorSourceRef.current = from;
        setConnectionDrag({ from, pointer: anchorPoint(node, "right") });
        selectSingleNode(node.id);
        setNotice("请选择连接终点");
        return;
      }
      if (source.nodeId !== node.id) {
        const from = source;
        const to = { nodeId: node.id, anchor: "left" as BoardAnchor };
        let connectorId = "";
        commitBoard((current) => ({
          ...current,
          connectors: [
            ...current.connectors,
            (() => {
              const connector = buildConnector(current.nodes, from, to, "rounded-orthogonal");
              connectorId = connector.id;
              return connector;
            })(),
          ],
        }));
        selectSingleConnector(connectorId);
      }
      connectorSourceRef.current = null;
      setConnectionDrag(null);
      toolRef.current = "select";
      setTool("select");
      setNotice("");
      return;
    }
    selectSingleNode(node.id);
  };

  const handleNodePointerDown = (event: ReactPointerEvent<SVGElement>, node: BoardNode) => {
    if (!canEdit || tool !== "select" || editingNodeId) return;
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      startCanvasPan(event);
      return;
    }
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = screenToBoard(event);
    beginContinuousInteraction();
    hideToolbarDuringDrag();
    const isActiveMultiNode = isMultiSelect && activeMultiSelectedNodes.some((item) => item.id === node.id);
    const dragNodeIds = isActiveMultiNode ? activeMultiSelectedNodes.map((item) => item.id) : [node.id];
    const dragConnectorIds = isActiveMultiNode ? activeMultiSelectedConnectors.map((item) => item.id) : [];
    setDragState({
      nodeIds: dragNodeIds,
      connectorIds: dragConnectorIds,
      startX: point.x,
      startY: point.y,
      nodePositions: Object.fromEntries(board.nodes.filter((item) => dragNodeIds.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])),
      connectorWaypoints: Object.fromEntries(board.connectors.filter((item) => dragConnectorIds.includes(item.id) || (dragNodeIds.includes(item.from.nodeId) && dragNodeIds.includes(item.to.nodeId))).map((item) => [item.id, item.waypoints.map((point) => ({ ...point }))])),
    });
    if (!isActiveMultiNode) {
      selectSingleNode(node.id);
    }
  };

  const handleResizePointerDown = (event: ReactPointerEvent<SVGElement>, node: BoardNode, handle: ResizeHandle) => {
    if (!canEdit) return;
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      startCanvasPan(event);
      return;
    }
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = screenToBoard(event);
    beginContinuousInteraction();
    hideToolbarDuringDrag();
    setResizeState({ nodeId: node.id, handle, startX: point.x, startY: point.y, node: structuredClone(node) });
    selectSingleNode(node.id);
  };

  const handleAnchorPointerDown = (event: ReactPointerEvent<SVGCircleElement>, node: BoardNode, anchor: BoardAnchor) => {
    if (!canEdit) return;
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      startCanvasPan(event);
      return;
    }
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = screenToBoard(event);
    setQuickAddPreview(null);
    hideToolbarDuringDrag();
    setConnectionDrag({ from: { nodeId: node.id, anchor }, pointer: point });
    selectSingleNode(node.id);
    toolRef.current = "connector";
    setTool("connector");
  };

  const handleAnchorPointerUp = (event: ReactPointerEvent<SVGCircleElement>, node: BoardNode, anchor: BoardAnchor) => {
    if (!canEdit || (!connectionDrag && !connectorEndpointDrag)) return;
    event.stopPropagation();
    if (connectorEndpointDrag) {
      const target = { nodeId: node.id, anchor };
      const targetConnectorId = connectorEndpointDrag.connectorId;
      const targetEndpoint = connectorEndpointDrag.endpoint;
      commitBoard((current) => ({
        ...current,
        connectors: current.connectors.map((connector) => {
          if (connector.id !== targetConnectorId) return connector;
          const opposite = targetEndpoint === "from" ? connector.to : connector.from;
          if (opposite.nodeId === target.nodeId && opposite.anchor === target.anchor) return connector;
          const nextConnector = targetEndpoint === "from"
            ? { ...connector, from: target }
            : { ...connector, to: target };
          return applyConnectorRouting(nextConnector, nextConnector.routingMode, current.nodes);
        }),
      }));
      setConnectorEndpointDrag(null);
      setHoveredAnchor(null);
      if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
      setFloatingToolbarDomHidden(false);
      setIsTransientToolbarHidden(false);
      selectSingleConnector(targetConnectorId);
      setTool("select");
      return;
    }
    const activeConnectionDrag = connectionDrag;
    if (!activeConnectionDrag) return;
    if (activeConnectionDrag.from.nodeId !== node.id) {
      const from = activeConnectionDrag.from;
      const to = { nodeId: node.id, anchor };
      let connectorId = "";
      commitBoard((current) => ({
        ...current,
        connectors: [
          ...current.connectors,
          (() => {
            const connector = buildConnector(current.nodes, from, to, "rounded-orthogonal");
            connectorId = connector.id;
            return connector;
          })(),
        ],
      }));
      selectSingleConnector(connectorId);
    }
    setConnectionDrag(null);
    setTool("select");
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panState) {
      setShapePlacementPreview(null);
      setBoard((current) => ({
        ...current,
        viewport: {
          ...current.viewport,
          x: panState.viewportX + event.clientX - panState.startX,
          y: panState.viewportY + event.clientY - panState.startY,
        },
      }));
      setIsDirty(true);
      return;
    }
    if (selectionRect) {
      setShapePlacementPreview(null);
      setSelectionRect({ ...selectionRect, current: screenToBoard(event) });
      return;
    }
    if (connectorHandleDrag) {
      setShapePlacementPreview(null);
      hideToolbarDuringDrag();
      const point = screenToBoard(event);
      setBoard((current) => ({
        ...current,
        connectors: current.connectors.map((connector) => {
          if (connector.id !== connectorHandleDrag.connectorId) return connector;
          const nextPoints = moveConnectorSegmentForConnector(
            connector,
            connectorHandleDrag.points,
            connectorHandleDrag.segmentIndex,
            connectorHandleDrag.orientation,
            point,
          );
          return {
            ...connector,
            routingMode: "polyline",
            style: { ...connector.style, cornerRadius: 0 },
            waypoints: nextPoints.slice(1, -1),
          };
        }),
      }));
      setIsDirty(true);
      return;
    }
    if (connectorPointDrag) {
      setShapePlacementPreview(null);
      hideToolbarDuringDrag();
      const point = screenToBoard(event);
      setBoard((current) => ({
        ...current,
        connectors: current.connectors.map((connector) => {
          if (connector.id !== connectorPointDrag.connectorId) return connector;
          const nextPoints = connectorPointDrag.points.map((item) => ({ ...item }));
          nextPoints[connectorPointDrag.pointIndex] = point;
          return {
            ...connector,
            routingMode: "polyline",
            style: { ...connector.style, cornerRadius: 0 },
            waypoints: nextPoints.slice(1, -1),
          };
        }),
      }));
      setIsDirty(true);
      return;
    }
    if (connectorLabelDrag) {
      setShapePlacementPreview(null);
      hideToolbarDuringDrag();
      const point = screenToBoard(event);
      setBoard((current) => ({
        ...current,
        connectors: current.connectors.map((connector) => {
          if (connector.id !== connectorLabelDrag.connectorId) return connector;
          const geometry = connectorGeometry(connector, current.nodes);
          if (!geometry) return connector;
          const anchor = nearestPointOnConnector(geometry.points, point);
          return {
            ...connector,
            labelPosition: anchor.point,
            labelSegmentIndex: anchor.segmentIndex,
            labelSegmentT: anchor.t,
          };
        }),
      }));
      setIsDirty(true);
      return;
    }
    if (connectorEndpointDrag) {
      hideToolbarDuringDrag();
      setQuickAddPreview(null);
      setShapePlacementPreview(null);
      const point = screenToBoard(event);
      const activeConnector = board.connectors.find((connector) => connector.id === connectorEndpointDrag.connectorId);
      const opposite = activeConnector ? connectorEndpointDrag.endpoint === "from" ? activeConnector.to : activeConnector.from : null;
      const targetAnchor = nearestAnchor(
        point,
        board.nodes,
        (endpoint) => !opposite || endpoint.nodeId !== opposite.nodeId || endpoint.anchor !== opposite.anchor,
        32,
      );
      setConnectorEndpointDrag({ ...connectorEndpointDrag, pointer: point });
      setHoveredAnchor(targetAnchor);
      return;
    }
    if (connectionDrag) {
      setQuickAddPreview(null);
      setShapePlacementPreview(null);
      const point = screenToBoard(event);
      const target = nearestConnectableAnchor(point, board.nodes, connectionDrag.from, 42);
      const targetNode = target ? board.nodes.find((node) => node.id === target.nodeId) : null;
      setHoveredAnchor(target);
      setConnectionDrag({
        ...connectionDrag,
        pointer: target && targetNode ? anchorPoint(targetNode, target.anchor) : point,
      });
      return;
    }
    if (resizeState) {
      setShapePlacementPreview(null);
      hideToolbarDuringDrag();
      const point = screenToBoard(event);
      const dx = point.x - resizeState.startX;
      const dy = point.y - resizeState.startY;
      setBoard((current) => ({
        ...current,
        nodes: (() => {
          const nextNodes = current.nodes.map((node) => {
          if (node.id !== resizeState.nodeId) return node;
          const next = { ...resizeState.node };
          next.manualSize = true;
          if (resizeState.handle.includes("e")) next.width = Math.max(48, resizeState.node.width + dx);
          if (resizeState.handle.includes("s")) next.height = Math.max(32, resizeState.node.height + dy);
          if (resizeState.handle.includes("w")) {
            next.x = Math.min(resizeState.node.x + resizeState.node.width - 48, resizeState.node.x + dx);
            next.width = Math.max(48, resizeState.node.width - dx);
          }
          if (resizeState.handle.includes("n")) {
            next.y = Math.min(resizeState.node.y + resizeState.node.height - 32, resizeState.node.y + dy);
            next.height = Math.max(32, resizeState.node.height - dy);
          }
          return next;
          });
          return nextNodes;
        })(),
        connectors: adaptConnectorsForMovedNodes(
          current.connectors,
          current.nodes.map((node) => {
            if (node.id !== resizeState.nodeId) return node;
            const next = { ...resizeState.node };
            next.manualSize = true;
            if (resizeState.handle.includes("e")) next.width = Math.max(48, resizeState.node.width + dx);
            if (resizeState.handle.includes("s")) next.height = Math.max(32, resizeState.node.height + dy);
            if (resizeState.handle.includes("w")) {
              next.x = Math.min(resizeState.node.x + resizeState.node.width - 48, resizeState.node.x + dx);
              next.width = Math.max(48, resizeState.node.width - dx);
            }
            if (resizeState.handle.includes("n")) {
              next.y = Math.min(resizeState.node.y + resizeState.node.height - 32, resizeState.node.y + dy);
              next.height = Math.max(32, resizeState.node.height - dy);
            }
            return next;
          }),
          [resizeState.nodeId],
        ),
      }));
      setIsDirty(true);
      return;
    }
    if (!dragState) {
      updateShapePlacementPreview(event);
      return;
    }
    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    hideToolbarDuringDrag();
    const point = screenToBoard(event);
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;
    setBoard((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const base = dragState.nodePositions[node.id];
        return base ? { ...node, x: base.x + dx, y: base.y + dy } : node;
      }),
      connectors: adaptConnectorsForMovedNodes(
        current.connectors,
        current.nodes.map((node) => {
          const base = dragState.nodePositions[node.id];
          return base ? { ...node, x: base.x + dx, y: base.y + dy } : node;
        }),
        dragState.nodeIds,
        Object.fromEntries(Object.entries(dragState.connectorWaypoints).map(([connectorId, waypoints]) => [
          connectorId,
          waypoints.map((point) => ({ x: point.x + dx, y: point.y + dy })),
        ])),
      ),
    }));
    setIsDirty(true);
  };

  const handlePointerUp = (event?: ReactPointerEvent<SVGSVGElement>) => {
    if (selectionRect) {
      const rect = normalizeRect(selectionRect.start, selectionRect.current);
      if (isMeaningfulSelectionRect(rect)) {
        const nodeIds = board.nodes.filter((node) => rectsIntersect(rect, nodeRect(node))).map((node) => node.id);
        const connectorIds = board.connectors.filter((connector) => {
          const bounds = connectorBounds(connector, board.nodes);
          return bounds ? rectsIntersect(rect, bounds) : false;
        }).map((connector) => connector.id);
        applySelectionResult(nodeIds, connectorIds);
        suppressCanvasClickRef.current = true;
      }
      setSelectionRect(null);
      return;
    }
    if (connectorEndpointDrag) {
      const targetConnectorId = connectorEndpointDrag.connectorId;
      const targetEndpoint = connectorEndpointDrag.endpoint;
      const activeConnector = board.connectors.find((connector) => connector.id === targetConnectorId);
      const opposite = activeConnector ? targetEndpoint === "from" ? activeConnector.to : activeConnector.from : null;
      const releasePoint = event ? screenToBoard(event) : connectorEndpointDrag.pointer;
      const target = nearestAnchor(
        releasePoint,
        board.nodes,
        (endpoint) => !opposite || endpoint.nodeId !== opposite.nodeId || endpoint.anchor !== opposite.anchor,
        32,
      ) ?? hoveredAnchor;
      if (target) {
        commitBoard((current) => ({
          ...current,
          connectors: current.connectors.map((connector) => {
            if (connector.id !== targetConnectorId) return connector;
            const opposite = targetEndpoint === "from" ? connector.to : connector.from;
            if (opposite.nodeId === target.nodeId && opposite.anchor === target.anchor) return connector;
            const nextConnector = targetEndpoint === "from"
              ? { ...connector, from: target }
              : { ...connector, to: target };
            return applyConnectorRouting(nextConnector, nextConnector.routingMode, current.nodes);
          }),
        }));
        selectSingleConnector(targetConnectorId);
        setTool("select");
      }
      setConnectorEndpointDrag(null);
      setHoveredAnchor(null);
      if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
      setFloatingToolbarDomHidden(false);
      setIsTransientToolbarHidden(false);
      return;
    }
    if (panState || dragState || resizeState || connectorHandleDrag || connectorPointDrag || connectorLabelDrag) {
      const startSnapshot = interactionStartSnapshotRef.current;
      if (startSnapshot && !snapshotEquals(startSnapshot, board)) {
        setHistory((current) => ({ past: [...current.past, startSnapshot].slice(-80), future: [] }));
      }
    }
    interactionStartSnapshotRef.current = null;
    setPanState(null);
    setDragState(null);
    setResizeState(null);
    setConnectorHandleDrag(null);
    setConnectorPointDrag(null);
    setConnectorEndpointDrag(null);
    setConnectorLabelDrag(null);
    setHoveredAnchor(null);
    if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
    setFloatingToolbarDomHidden(false);
    setIsTransientToolbarHidden(false);
    if (connectionDrag && !connectorSourceRef.current) {
      const releasePoint = event ? screenToBoard(event) : connectionDrag.pointer;
      finishConnectionDragAtPoint(connectionDrag, releasePoint);
    }
  };

  const startCanvasPan = (event: Pick<ReactPointerEvent<SVGElement>, "clientX" | "clientY" | "preventDefault">) => {
    if (!canEdit) return;
    event.preventDefault();
    setShapePlacementPreview(null);
    beginContinuousInteraction();
    setPanState({
      startX: event.clientX,
      startY: event.clientY,
      viewportX: board.viewport.x,
      viewportY: board.viewport.y,
    });
  };

  const cancelCurrentOperation = () => {
    if (editingNodeId) {
      finishTextEditing();
    }
    if (editingConnectorLabel) {
      finishConnectorLabelEditing();
    }

    const hadContinuousInteraction = Boolean(
      panState
      || dragState
      || resizeState
      || connectorHandleDrag
      || connectorPointDrag
      || connectorEndpointDrag
      || connectorLabelDrag,
    );
    const startSnapshot = interactionStartSnapshotRef.current;
    if (hadContinuousInteraction && startSnapshot && !snapshotEquals(startSnapshot, board)) {
      setBoard((current) => ({
        ...current,
        nodes: structuredClone(startSnapshot.nodes),
        connectors: structuredClone(startSnapshot.connectors),
        viewport: { ...startSnapshot.viewport },
      }));
      setIsDirty(true);
    }

    clearQuickAddPressTimer();
    quickAddPressRef.current = null;
    quickAddSuppressClickRef.current = true;
    connectorSourceRef.current = null;
    interactionStartSnapshotRef.current = null;

    setQuickAddPreview(null);
    setShapePlacementPreview(null);
    setSelectionRect(null);
    setConnectionDrag(null);
    setConnectorEndpointDrag(null);
    setConnectorHandleDrag(null);
    setConnectorPointDrag(null);
    setConnectorLabelDrag(null);
    setPanState(null);
    setDragState(null);
    setResizeState(null);
    setHoveredAnchor(null);
    setActivePanel(null);
    setShapePaletteOpen(false);
    setNotice("");
    if (dragToolbarTimerRef.current) window.clearTimeout(dragToolbarTimerRef.current);
    setFloatingToolbarDomHidden(false);
    setIsTransientToolbarHidden(false);
    toolRef.current = "select";
    setTool("select");
  };

  useEffect(() => {
    const handleGlobalEscape = (event: globalThis.KeyboardEvent) => {
      if (!canEdit || event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      cancelCurrentOperation();
    };
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [
    canEdit,
    editingNodeId,
    panState,
    dragState,
    resizeState,
    connectorHandleDrag,
    connectorPointDrag,
    connectorEndpointDrag,
    board,
  ]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!canEdit) return;
    if (event.button === 1) {
      startCanvasPan(event);
      return;
    }
    if (event.button !== 0) return;
    if (tool === "pan") {
      startCanvasPan(event);
      return;
    }
    if (tool === "select") {
      setShapePlacementPreview(null);
      const point = screenToBoard(event);
      setSelectionRect({ start: point, current: point });
    }
  };

  const handleCanvasPointerLeave = (event: ReactPointerEvent<SVGSVGElement>) => {
    setShapePlacementPreview(null);
    handlePointerUp(event);
  };

  const handleCanvasClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }
    if (editingNodeId) return;
    const activeTool = toolRef.current;
    if (canEdit && (activeTool === "shape" || activeTool === "text")) {
      const point = screenToBoard(event);
      const type = activeTool === "text" ? "text" : pendingShape;
      const { width, height } = defaultNodeSize(type);
      addNodeAt(type, point.x - width / 2, point.y - height / 2);
      setShapePlacementPreview(null);
      setShapePaletteOpen(false);
      return;
    }
    clearSelection();
  };

  const zoom = (value: number) => {
    commitBoard((current) => ({
      ...current,
      viewport: { ...current.viewport, zoom: Math.min(4, Math.max(0.25, Number((current.viewport.zoom + value).toFixed(2)))) },
    }));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const target = event.target as HTMLElement;
    const isEditingText = target.tagName === "TEXTAREA" || target.tagName === "INPUT";
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      cancelCurrentOperation();
      return;
    }
    if (isEditingText) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    if (!meta) return;
    const key = event.key.toLowerCase();
    if (key === "z" && event.shiftKey) {
      event.preventDefault();
      redo();
    } else if (key === "z") {
      event.preventDefault();
      undo();
    } else if (key === "c" && selectedNode) {
      event.preventDefault();
      setClipboardNode(structuredClone(selectedNode));
    } else if (key === "x" && selectedNode) {
      event.preventDefault();
      setClipboardNode(structuredClone(selectedNode));
      deleteSelected();
    } else if (key === "v" && clipboardNode) {
      event.preventDefault();
      let newId = "";
      commitBoard((current) => {
        newId = crypto.randomUUID();
        return {
          ...current,
          nodes: [...current.nodes, { ...structuredClone(clipboardNode), id: newId, x: clipboardNode.x + 24, y: clipboardNode.y + 24, zIndex: Math.max(0, ...current.nodes.map((node) => node.zIndex)) + 1 }],
        };
      });
      selectSingleNode(newId);
    } else if (key === "d" && (selectedNode || isMultiSelect)) {
      event.preventDefault();
      duplicateSelected();
    }
  };

  const handleDeleteDocument = () => {
    startTransition(async () => {
      try {
        await softDeleteDocument(currentDocument.id);
        router.replace(fallbackUrl);
        router.refresh();
      } catch {
        setNotice("删除画板失败");
      }
    });
  };

  const toolbarPoint = useMemo(() => {
    if (isMultiSelect && activeMultiSelectionBounds) {
      const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
      const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
      const toolbarWidth = 236;
      const below = boardToScreen({ x: activeMultiSelectionBounds.x + activeMultiSelectionBounds.width / 2, y: activeMultiSelectionBounds.y + activeMultiSelectionBounds.height + 14 });
      const above = boardToScreen({ x: activeMultiSelectionBounds.x + activeMultiSelectionBounds.width / 2, y: activeMultiSelectionBounds.y - 54 });
      const left = Math.max(68, Math.min(viewportWidth - toolbarWidth - 24, below.x - toolbarWidth / 2));
      const top = below.y > viewportHeight - 112 ? above.y : below.y;
      return { left, top: Math.max(58, top) };
    }
    if (selectedNode) {
      const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
      const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
      const toolbarWidth = 438;
      const toolbarHeight = 40;
      const quickAddClearance = 42;
      const below = boardToScreen({ x: selectedNode.x + selectedNode.width / 2, y: selectedNode.y + selectedNode.height + quickAddClearance });
      const above = boardToScreen({ x: selectedNode.x + selectedNode.width / 2, y: selectedNode.y - toolbarHeight - quickAddClearance });
      const left = Math.max(68, Math.min(viewportWidth - toolbarWidth - 24, below.x - toolbarWidth / 2));
      const top = below.y > viewportHeight - toolbarHeight - 24 ? above.y : below.y;
      return { left, top: Math.max(58, top) };
    }
    if (selectedConnector) {
      const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
      const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
      const toolbarWidth = 360;
      const geometry = connectorGeometry(selectedConnector, board.nodes);
      if (!geometry) return null;
      const xs = geometry.points.map((point) => point.x);
      const ys = geometry.points.map((point) => point.y);
      const screen = boardToScreen({
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: Math.max(...ys) + 12,
      });
      const left = Math.max(68, Math.min(viewportWidth - toolbarWidth - 24, screen.x - toolbarWidth / 2));
      const top = screen.y > viewportHeight - 112 ? screen.y - 58 : screen.y;
      return { left, top: Math.max(58, top) };
    }
    return null;
  }, [selectedNode, selectedConnector, board, isMultiSelect, activeMultiSelectionBounds]);
  const toolbarPanelStyle = useMemo(() => {
    const toolbarHeight = 40;
    const gap = 4;
    const edgePadding = 12;
    const minPanelHeight = 160;
    const preferredPanelHeight = activePanel === "line" ? 340 : 240;
    const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
    if (!toolbarPoint) {
      return { top: toolbarHeight + gap, maxHeight: preferredPanelHeight };
    }
    const belowSpace = viewportHeight - (toolbarPoint.top + toolbarHeight + gap) - edgePadding;
    const aboveSpace = toolbarPoint.top - edgePadding;
    const shouldOpenAbove = belowSpace < preferredPanelHeight && aboveSpace > belowSpace;
    const availableSpace = Math.max(minPanelHeight, Math.floor(shouldOpenAbove ? aboveSpace : belowSpace));
    return shouldOpenAbove
      ? { bottom: toolbarHeight + gap, maxHeight: availableSpace }
      : { top: toolbarHeight + gap, maxHeight: availableSpace };
  }, [activePanel, toolbarPoint]);

  const renderNodeShape = (node: BoardNode, selected: boolean) => {
    const common = {
      fill: node.style.fill,
      fillOpacity: DEFAULT_NODE_FILL_OPACITY,
      stroke: selected ? "#5b8cff" : node.style.stroke,
      strokeWidth: selected ? Math.max(2.4, node.style.strokeWidth) : node.style.strokeWidth,
      strokeDasharray: node.style.strokeDasharray || undefined,
    };
    if (node.type === "ellipse") {
      return <ellipse cx={node.x + node.width / 2} cy={node.y + node.height / 2} rx={node.width / 2} ry={node.height / 2} {...common} />;
    }
    if (node.type === "diamond" || node.type === "triangle" || node.type === "star" || node.type === "parallelogram" || node.type === "hexagon" || node.type === "plus" || node.type === "trapezoid" || node.type === "predefined_process") {
      return <polygon points={node.type === "diamond" ? diamondPath(node) : polygonPoints(node)} {...common} />;
    }
    if (node.type === "document") {
      return <path d={documentPath(node)} {...common} />;
    }
    if (node.type === "comment_bubble") {
      return <path d={commentBubblePath(node)} {...common} />;
    }
    if (node.type === "cloud") {
      return <path d={cloudPath(node)} {...common} />;
    }
    if (node.type === "left_arrow") {
      return <path d={leftArrowPath(node)} {...common} />;
    }
    if (node.type === "arrow") {
      return <path d={arrowPath(node)} {...common} />;
    }
    if (node.type === "cylinder") {
      return (
        <g>
          <rect x={node.x} y={node.y + 8} width={node.width} height={node.height - 16} {...common} />
          <ellipse cx={node.x + node.width / 2} cy={node.y + 8} rx={node.width / 2} ry={8} {...common} />
          <path d={`M ${node.x} ${node.y + node.height - 8} C ${node.x} ${node.y + node.height + 3}, ${node.x + node.width} ${node.y + node.height + 3}, ${node.x + node.width} ${node.y + node.height - 8}`} fill="none" stroke={node.style.stroke} strokeWidth={node.style.strokeWidth} />
        </g>
      );
    }
    if (node.type === "text") {
      return <rect x={node.x} y={node.y} width={node.width} height={node.height} fill="transparent" stroke={selected ? "#5b8cff" : "transparent"} strokeWidth="2" />;
    }
    return <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.type === "round_rectangle" ? 8 : 0} {...common} />;
  };

  const renderNodeText = (node: BoardNode) => {
    const lineHeight = node.style.fontSize * 1.25;
    if (editingNodeId === node.id) {
      return (
        <foreignObject x={node.x + 6} y={node.y + 6} width={Math.max(20, node.width - 12)} height={Math.max(20, node.height - 12)}>
          <textarea
            ref={textAreaRef}
            value={editingText}
            onChange={(event) => setEditingText(event.target.value)}
            onBlur={finishTextEditing}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                finishTextEditing();
              }
              event.stopPropagation();
            }}
            className="h-full w-full resize-none border-0 bg-transparent p-1 text-center text-slate-800 outline-none"
            style={{
              fontSize: node.style.fontSize,
              lineHeight: `${lineHeight}px`,
              color: node.style.color,
              textAlign: node.style.textAlign ?? "center",
              fontWeight: node.style.fontWeight ?? 400,
              overflow: "auto",
            }}
          />
        </foreignObject>
      );
    }
    const lines = boardNodeTextLines(node);
    const textOverflows = requiredNodeHeightForText(node) > node.height + 1;
    if (textOverflows) {
      return (
        <foreignObject
          x={node.x + 8}
          y={node.y + 8}
          width={Math.max(20, node.width - 16)}
          height={Math.max(20, node.height - 16)}
          data-board-node-text-overflow="true"
        >
          <div
            className="h-full w-full overflow-auto whitespace-pre-wrap break-words"
            onClick={(event) => {
              event.stopPropagation();
              handleNodeClick(node);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              startTextEditing(node);
            }}
            onPointerDown={(event) => handleNodePointerDown(event as unknown as ReactPointerEvent<SVGElement>, node)}
            style={{
              color: node.style.color,
              fontSize: node.style.fontSize,
              fontWeight: node.style.fontWeight,
              lineHeight: `${lineHeight}px`,
              textAlign: node.style.textAlign ?? "center",
            }}
          >
            {node.text || " "}
          </div>
        </foreignObject>
      );
    }
    const startY = node.y + node.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    const textAnchor = node.style.textAlign === "left" ? "start" : node.style.textAlign === "right" ? "end" : "middle";
    const x = node.style.textAlign === "left" ? node.x + 10 : node.style.textAlign === "right" ? node.x + node.width - 10 : node.x + node.width / 2;
    return (
      <text x={x} y={startY} dominantBaseline="middle" textAnchor={textAnchor} fill={node.style.color} fontSize={node.style.fontSize} fontWeight={node.style.fontWeight} className="pointer-events-none select-none">
        {lines.map((line, index) => (
          <tspan key={`${node.id}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>
            {line || " "}
          </tspan>
        ))}
      </text>
    );
  };

  return (
    <div className="relative h-screen min-h-0 overflow-hidden bg-[#fbfbfa] text-slate-900" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="absolute left-4 top-4 z-40 flex h-9 items-center overflow-hidden border border-[#dee3ee] bg-white/95 text-[13px] shadow-[0_2px_10px_rgba(31,35,41,0.08)]">
        <Link href={fallbackUrl} className="grid h-9 w-9 place-items-center border-r border-[#eef1f6] text-lg leading-none text-[#1f2329] hover:bg-[#f5f7fb]" title="返回">‹</Link>
        <span className="grid h-9 w-9 place-items-center border-r border-[#eef1f6] text-[#3370ff]"><BoardIcon name="frame" className="h-4 w-4" /></span>
        <span className="max-w-[180px] truncate border-r border-[#eef1f6] px-2.5 text-[#1f2329]">{spaceName ?? "画板文档"}</span>
        <span className="grid h-9 w-9 place-items-center border-r border-[#eef1f6] text-[#1f2329]"><ShapeIcon type="rectangle" className="h-4 w-4" /></span>
        <span className="max-w-[180px] truncate px-2.5 font-medium text-[#1f2329]">画板</span>
      </div>

      <div className="absolute right-4 top-4 z-40 flex h-9 items-center overflow-hidden border border-[#dee3ee] bg-white/95 text-[13px] shadow-[0_2px_10px_rgba(31,35,41,0.08)]">
        <span className="border-r border-[#eef1f6] px-2.5 text-xs text-[#646a73]">{isSaving ? "保存中" : isDirty ? "未保存" : "已保存"}</span>
        <button type="button" className="flex h-9 items-center gap-1.5 border-r border-[#eef1f6] px-3 text-[#1456f0] hover:bg-[#f5f8ff]"><BoardIcon name="share" className="h-3.5 w-3.5" />分享</button>
        <span className="flex h-9 items-center gap-1.5 border-r border-[#eef1f6] px-3 text-[#1f2329]"><BoardIcon name="edit" className="h-3.5 w-3.5" />{canEdit ? "编辑" : "只读"}⌄</span>
        <button type="button" onClick={undo} disabled={!canEdit || history.past.length === 0} className="grid h-9 w-9 place-items-center border-r border-[#eef1f6] text-[#1f2329] hover:bg-[#f5f7fb] disabled:text-[#a8aeb8]"><BoardIcon name="undo" className="h-4 w-4" /></button>
        <button type="button" onClick={redo} disabled={!canEdit || history.future.length === 0} className="grid h-9 w-9 place-items-center border-r border-[#eef1f6] text-[#1f2329] hover:bg-[#f5f7fb] disabled:text-[#a8aeb8]"><BoardIcon name="redo" className="h-4 w-4" /></button>
        <button type="button" onClick={() => void saveBoard()} disabled={!canEdit || isSaving} className="h-9 border-r border-[#eef1f6] px-3 text-[#1f2329] hover:bg-[#f5f7fb] disabled:opacity-40">保存</button>
        {canDelete ? <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={isMutating} className="h-9 border-r border-[#eef1f6] px-3 text-[#d83931] hover:bg-[#fff1f0]">删除</button> : null}
        <span className="grid h-9 w-9 place-items-center text-[#1f2329]"><BoardIcon name="more" /></span>
      </div>

      <main className="h-full w-full">
        <aside className="absolute left-4 top-[102px] z-30 flex w-[58px] flex-col items-center rounded-[14px] border border-[#d0d7e5] bg-white/98 py-2 shadow-[0_8px_24px_rgba(31,35,41,0.14)] backdrop-blur-[2px]">
          {[
            ["select", "select", "选择"],
            ["shape", "pending-shape", "图形"],
            ["text", "text", "文本"],
            ["pan", "pan", "拖动画布"],
          ].map(([value, icon, label], index) => (
            <div key={`${value}-${index}`} className="contents">
              <button
                type="button"
                title={label}
                disabled={!(value === "select" || value === "shape" || value === "text" || value === "pan")}
                onMouseEnter={() => {
                  if (value === "shape" && canEdit) {
                    openShapePalette();
                  }
                }}
                onMouseLeave={() => {
                  if (value === "shape") {
                    scheduleCloseShapePalette();
                  }
                }}
                onClick={() => {
                  if (!(value === "select" || value === "shape" || value === "text" || value === "pan")) {
                    return;
                  }
                  const nextTool = value as BoardTool;
                  toolRef.current = nextTool;
                  setTool(nextTool);
                  connectorSourceRef.current = null;
                  setConnectionDrag(null);
                  if (nextTool === "shape") {
                    setActivePanel(null);
                  }
                  setShapePaletteOpen(nextTool === "shape" ? !shapePaletteOpen : false);
                  if (nextTool !== "shape") {
                    setActivePanel(null);
                  }
                  if (nextTool !== "shape" && nextTool !== "text") {
                    setShapePlacementPreview(null);
                  }
                }}
                className={`my-0.5 grid h-[46px] w-[46px] place-items-center rounded-[10px] border border-transparent text-[16px] transition-[background-color,color,box-shadow,border-color] ${tool === value ? "border-[#d6e4ff] bg-[#eef3ff] text-[#1456f0] shadow-[0_1px_0_rgba(20,86,240,0.04),inset_0_0_0_1px_#d9e4ff]" : "bg-transparent text-[#1f2329] hover:border-[#e2e7f0] hover:bg-[#f5f7fb]"} disabled:cursor-not-allowed disabled:text-[#8f959e]`}
              >
                {value === "shape"
                  ? <ShapeIcon type={pendingShape} className="h-[24px] w-[24px]" />
                  : <BoardIcon name={icon as BoardIconName} className="h-[24px] w-[24px]" />}
              </button>
              {index === 1 ? <div className="my-2 h-px w-7 bg-[#e3e8f1]" /> : null}
            </div>
          ))}
        </aside>

        <section className="relative h-full w-full overflow-hidden">
          {shapePaletteOpen ? (
            <div
              className="absolute left-[68px] top-[204px] z-[70] w-[198px] rounded-[12px] border border-[#e3e7ef] bg-white p-3 shadow-[0_8px_28px_rgba(31,35,41,0.14)]"
              onMouseEnter={openShapePalette}
              onMouseLeave={scheduleCloseShapePalette}
            >
              <div className="grid grid-cols-5 gap-2">
                {SHAPE_ITEMS.map((shape) => (
                  <button
                    key={shape.type}
                    type="button"
                    title={shape.label}
                    onClick={() => {
                      setPendingShape(shape.type);
                      toolRef.current = "shape";
                      setTool("shape");
                      setShapePlacementPreview(null);
                      setShapePaletteOpen(false);
                    }}
                    className={`grid h-8 w-8 place-items-center rounded-[8px] border transition-colors ${pendingShape === shape.type ? "border-[#d6e4ff] bg-[#eef3ff] text-[#1456f0]" : "border-transparent text-[#1f2329] hover:border-[#e6ebf5] hover:bg-[#f6f8fc] hover:text-[#1456f0]"}`}
                  >
                    <ShapeIcon type={shape.type} className="h-[17px] w-[17px]" />
                  </button>
                ))}
              </div>
              <button type="button" className="mt-3 h-8 w-full rounded-[8px] border border-[#dee3ee] bg-white text-xs text-[#1456f0] hover:bg-[#f5f8ff]">更多图形</button>
            </div>
          ) : null}

          <svg
            ref={svgRef}
            className={`h-full w-full ${tool === "pan" ? "cursor-grab" : tool === "shape" || tool === "text" ? "cursor-crosshair" : "cursor-default"}`}
            style={{
                          backgroundColor: "#fbfbfa",
              backgroundImage: "radial-gradient(circle, #c9d1da 1px, transparent 1.2px)",
              backgroundSize: "43px 43px",
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handleCanvasPointerLeave}
            onAuxClick={(event) => event.preventDefault()}
            onClick={handleCanvasClick}
          >
            <defs>
              <marker id="board-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="strokeWidth">
                <path d="M0,0 L9,4.5 L0,9 Z" fill="context-stroke" />
              </marker>
            </defs>
            <g transform={`translate(${board.viewport.x} ${board.viewport.y}) scale(${board.viewport.zoom})`}>
              {[...board.connectors].sort((a, b) => a.zIndex - b.zIndex).map((connector) => {
                const geometry = connectorGeometry(connector, board.nodes);
                if (!geometry) return null;
                const selected = selectedConnectorId === connector.id || (isMultiSelect && activeMultiSelectedConnectors.some((item) => item.id === connector.id));
                const displayStroke = selected ? "#3370ff" : connector.style.stroke;
                return (
                  <g key={connector.id}>
                    <path
                      d={geometry.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(14, connector.style.strokeWidth * 8)}
                      pointerEvents="stroke"
                      className="cursor-pointer"
                      onPointerDown={(event) => {
                        if (!canEdit || !isMultiSelect || !activeMultiSelectedConnectors.some((item) => item.id === connector.id) || activeMultiSelectionBounds == null) return;
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        const now = window.performance.now();
                        const lastClick = connectorClickRef.current;
                        connectorClickRef.current = { connectorId: connector.id, at: now };
                        if (event.detail >= 2 || (lastClick?.connectorId === connector.id && now - lastClick.at <= 350)) {
                          startConnectorLabelEditing(connector, screenToBoard(event));
                          return;
                        }
                        if (isMultiSelect && activeMultiSelectedConnectors.some((item) => item.id === connector.id)) return;
                        selectSingleConnector(connector.id);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        startConnectorLabelEditing(connector, screenToBoard(event));
                      }}
                    />
                    <path
                      d={geometry.path}
                      fill="none"
                      stroke={displayStroke}
                      strokeWidth={selected ? Math.max(2, connector.style.strokeWidth + 0.35) : connector.style.strokeWidth}
                      strokeDasharray={connector.style.strokeDasharray || undefined}
                      markerStart={connector.style.startArrow === "arrow" ? "url(#board-arrow)" : undefined}
                      markerEnd={connector.style.endArrow === "arrow" ? "url(#board-arrow)" : undefined}
                      className="pointer-events-none"
                    />
                    {connector.label ? (() => {
                      const point = connectorLabelPoint(connector, geometry.points);
                      const labelWidth = Math.min(220, Math.max(36, connector.label.length * 8 + 16));
                      const labelActive = selected || connectorLabelDrag?.connectorId === connector.id;
                      return (
                        <foreignObject
                          x={point.x - labelWidth / 2}
                          y={point.y - 12}
                          width={labelWidth}
                          height={24}
                          className={canEdit ? "overflow-visible" : "pointer-events-none"}
                        >
                          <div
                            data-board-connector-label={connector.id}
                            className={`flex h-full items-center justify-center whitespace-nowrap border bg-[#fbfbfa]/90 px-1 text-[12px] leading-6 text-[#1f2329] ${canEdit ? "cursor-move" : ""} ${labelActive ? "border-[#5b8cff] shadow-[0_1px_4px_rgba(51,112,255,0.18)]" : "border-transparent hover:border-[#8fb1ff]"}`}
                            onPointerDown={(event) => startConnectorLabelDrag(event, connector)}
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              startConnectorLabelEditing(connector, point);
                            }}
                          >
                            {connector.label}
                          </div>
                        </foreignObject>
                      );
                    })() : null}
                  </g>
                );
              })}
              {connectionDrag ? (() => {
                const from = board.nodes.find((node) => node.id === connectionDrag.from.nodeId);
                if (!from) return null;
                const start = anchorPoint(from, connectionDrag.from.anchor);
                const hoveredTargetNode = hoveredAnchor ? board.nodes.find((node) => node.id === hoveredAnchor.nodeId) : null;
                const targetPoint = hoveredTargetNode && hoveredAnchor ? anchorPoint(hoveredTargetNode, hoveredAnchor.anchor) : connectionDrag.pointer;
                const draftConnector: BoardConnector = {
                  id: "draft",
                  from: connectionDrag.from,
                  to: hoveredTargetNode && hoveredAnchor ? { nodeId: hoveredTargetNode.id, anchor: hoveredAnchor.anchor } : { nodeId: "draft", anchor: "left" },
                  routingMode: "rounded-orthogonal",
                  waypoints: [],
                  label: "",
                  style: { ...DEFAULT_CONNECTOR_STYLE, stroke: "#5b7fd8", strokeDasharray: "4 3", cornerRadius: DEFAULT_CONNECTOR_STYLE.cornerRadius },
                  zIndex: 0,
                };
                const points = hoveredTargetNode && hoveredAnchor
                  ? [start, ...defaultConnectorWaypointsForNodes(draftConnector, from, hoveredTargetNode), targetPoint]
                  : connectorPoints({
                      ...draftConnector,
                      waypoints: defaultConnectorWaypoints(start, targetPoint, connectionDrag.from.anchor, "left", "rounded-orthogonal"),
                    }, start, targetPoint);
                return <path d={connectorPath(points, draftConnector)} fill="none" stroke="#5b7fd8" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#board-arrow)" />;
              })() : null}
              {connectorEndpointDrag ? (() => {
                const connector = board.connectors.find((item) => item.id === connectorEndpointDrag.connectorId);
                if (!connector) return null;
                const fromNode = board.nodes.find((node) => node.id === connector.from.nodeId);
                const toNode = board.nodes.find((node) => node.id === connector.to.nodeId);
                if (!fromNode || !toNode) return null;
                const hoverNode = hoveredAnchor ? board.nodes.find((node) => node.id === hoveredAnchor.nodeId) : null;
                const dragPoint = hoverNode && hoveredAnchor ? anchorPoint(hoverNode, hoveredAnchor.anchor) : connectorEndpointDrag.pointer;
                const start = connectorEndpointDrag.endpoint === "from" ? dragPoint : anchorPoint(fromNode, connector.from.anchor);
                const end = connectorEndpointDrag.endpoint === "to" ? dragPoint : anchorPoint(toNode, connector.to.anchor);
                const fromAnchor = connectorEndpointDrag.endpoint === "from" ? hoveredAnchor?.anchor ?? connector.from.anchor : connector.from.anchor;
                const toAnchor = connectorEndpointDrag.endpoint === "to" ? hoveredAnchor?.anchor ?? connector.to.anchor : connector.to.anchor;
                const draftConnector: BoardConnector = {
                  ...connector,
                  from: connectorEndpointDrag.endpoint === "from" && hoverNode ? { nodeId: hoverNode.id, anchor: fromAnchor } : connectorEndpointDrag.endpoint === "from" ? { nodeId: "draft", anchor: fromAnchor } : connector.from,
                  to: connectorEndpointDrag.endpoint === "to" && hoverNode ? { nodeId: hoverNode.id, anchor: toAnchor } : connectorEndpointDrag.endpoint === "to" ? { nodeId: "draft", anchor: toAnchor } : connector.to,
                  waypoints: [],
                  style: { ...connector.style, stroke: "#3370ff", strokeDasharray: "4 3" },
                };
                const points = hoverNode && hoveredAnchor
                  ? [
                      start,
                      ...defaultConnectorWaypointsForNodes(
                        draftConnector,
                        connectorEndpointDrag.endpoint === "from" ? hoverNode : fromNode,
                        connectorEndpointDrag.endpoint === "to" ? hoverNode : toNode,
                      ),
                      end,
                    ]
                  : connectorPoints({
                      ...draftConnector,
                      waypoints: defaultConnectorWaypoints(start, end, fromAnchor, toAnchor, connector.routingMode),
                    }, start, end);
                return <path d={connectorPath(points, draftConnector)} fill="none" stroke="#3370ff" strokeWidth="1.8" strokeDasharray="4 3" markerEnd={connector.style.endArrow === "arrow" ? "url(#board-arrow)" : undefined} />;
              })() : null}
              {quickAddPreview && !connectionDrag && !connectorEndpointDrag ? (() => {
                const source = board.nodes.find((node) => node.id === quickAddPreview.sourceNodeId);
                if (!source) return null;
                const previewNode = buildQuickAddPreviewNode(source, quickAddPreview.anchor);
                const previewConnector: BoardConnector = {
                  id: "quick-add-preview-connector",
                  from: { nodeId: source.id, anchor: quickAddPreview.anchor },
                  to: { nodeId: previewNode.id, anchor: oppositeAnchor(quickAddPreview.anchor) },
                  routingMode: "rounded-orthogonal",
                  waypoints: defaultConnectorWaypointsForNodes({
                    id: "quick-add-preview-connector",
                    from: { nodeId: source.id, anchor: quickAddPreview.anchor },
                    to: { nodeId: previewNode.id, anchor: oppositeAnchor(quickAddPreview.anchor) },
                    routingMode: "rounded-orthogonal",
                    waypoints: [],
                    label: "",
                    style: { ...DEFAULT_CONNECTOR_STYLE, stroke: "#5b7fd8", strokeDasharray: "4 3", cornerRadius: DEFAULT_CONNECTOR_STYLE.cornerRadius },
                    zIndex: 0,
                  }, source, previewNode),
                  label: "",
                  style: { ...DEFAULT_CONNECTOR_STYLE, stroke: "#5b7fd8", strokeDasharray: "4 3", cornerRadius: DEFAULT_CONNECTOR_STYLE.cornerRadius },
                  zIndex: 0,
                };
                const start = anchorPoint(source, quickAddPreview.anchor);
                const end = anchorPoint(previewNode, oppositeAnchor(quickAddPreview.anchor));
                const points = connectorPoints(previewConnector, start, end);
                return (
                  <g className="pointer-events-none">
                    <path d={connectorPath(points, previewConnector)} fill="none" stroke="#5b7fd8" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#board-arrow)" />
                    <g opacity="0.48">
                      {renderNodeShape(previewNode, false)}
                      {renderNodeText(previewNode)}
                    </g>
                  </g>
                );
              })() : null}
              {shapePlacementPreview && !connectionDrag && !connectorEndpointDrag && !dragState && !resizeState ? (() => {
                const previewNode: BoardNode = {
                  id: "shape-placement-preview",
                  type: shapePlacementPreview.type,
                  x: shapePlacementPreview.x,
                  y: shapePlacementPreview.y,
                  width: shapePlacementPreview.width,
                  height: shapePlacementPreview.height,
                  text: "",
                  manualSize: false,
                  style: {
                    ...DEFAULT_NODE_STYLE,
                    fill: shapePlacementPreview.type === "text" ? "transparent" : DEFAULT_NODE_STYLE.fill,
                    strokeDasharray: "5 4",
                  },
                  zIndex: 0,
                };
                return (
                  <g data-board-placement-preview="true" className="pointer-events-none" opacity="0.52">
                    {previewNode.type === "text" ? (
                      <rect
                        x={previewNode.x}
                        y={previewNode.y}
                        width={previewNode.width}
                        height={previewNode.height}
                        fill="transparent"
                        stroke="#5b8cff"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                      />
                    ) : renderNodeShape(previewNode, false)}
                  </g>
                );
              })() : null}
              {[...board.nodes].sort((a, b) => a.zIndex - b.zIndex).map((node) => {
                const renderNode = editingNodeId === node.id && !node.manualSize ? fitNodeHeightToText({ ...node, text: editingText }, editingText) : node;
                const selected = selectedNodeId === renderNode.id || (isMultiSelect && activeMultiSelectedNodes.some((item) => item.id === renderNode.id));
                const showResizeHandles = selected && !isMultiSelect && canEdit && editingNodeId !== node.id;
                const showAnchors = !isMultiSelect && canEdit && editingNodeId !== node.id && (selected || Boolean(connectionDrag) || Boolean(connectorEndpointDrag));
                const showQuickAddHandles = showAnchors && selected && !connectionDrag && !connectorEndpointDrag && tool === "select";
                return (
                  <g
                    key={renderNode.id}
                    data-board-node={renderNode.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleNodeClick(renderNode);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      startTextEditing(renderNode);
                    }}
                    onPointerDown={(event) => handleNodePointerDown(event, renderNode)}
                    className={canEdit ? "cursor-move" : "cursor-default"}
                  >
                    {renderNodeShape(renderNode, selected)}
                    {renderNodeText(renderNode)}
                    {showResizeHandles || showAnchors ? (
                      <>
                        {showAnchors ? ANCHORS.map((anchor) => {
                          const point = anchorPoint(renderNode, anchor);
                          const isSourceAnchor = connectionDrag?.from.nodeId === renderNode.id && connectionDrag.from.anchor === anchor;
                          const isHoverAnchor = hoveredAnchor?.nodeId === renderNode.id && hoveredAnchor.anchor === anchor;
                          const isEndpointTarget = Boolean(connectorEndpointDrag);
                          return (
                            <circle
                              key={anchor}
                              cx={point.x}
                              cy={point.y}
                              r={isHoverAnchor ? 5.4 : 4.4}
                              fill={isHoverAnchor ? "#5b8cff" : isSourceAnchor ? "#dfeaff" : "#bdd0ff"}
                              stroke={isHoverAnchor ? "#ffffff" : "transparent"}
                              strokeWidth={isHoverAnchor ? "1.5" : "0"}
                              className="cursor-crosshair"
                              onPointerEnter={() => {
                                if ((connectionDrag && connectionDrag.from.nodeId !== renderNode.id) || isEndpointTarget) {
                                  setHoveredAnchor({ nodeId: renderNode.id, anchor });
                                }
                              }}
                              onPointerLeave={() => {
                                if (hoveredAnchor?.nodeId === renderNode.id && hoveredAnchor.anchor === anchor) {
                                  setHoveredAnchor(null);
                                }
                              }}
                              onPointerDown={(event) => handleAnchorPointerDown(event, renderNode, anchor)}
                              onPointerUp={(event) => handleAnchorPointerUp(event, renderNode, anchor)}
                            />
                          );
                        }) : null}
                        {showResizeHandles ? (
                          <>
                            {RESIZE_HANDLES.map((handle) => (
                              <rect
                                key={handle.id}
                                x={renderNode.x + renderNode.width * handle.x - 3.4}
                                y={renderNode.y + renderNode.height * handle.y - 3.4}
                                width={6.8}
                                height={6.8}
                                rx={1.5}
                                fill="#ffffff"
                                stroke="#5b8cff"
                                strokeWidth="1.4"
                                style={{ cursor: handle.cursor }}
                                onPointerDown={(event) => handleResizePointerDown(event, renderNode, handle.id)}
                              />
                            ))}
                          </>
                        ) : null}
                        {showQuickAddHandles ? ANCHORS.map((anchor) => {
                          const edgePoint = anchorPoint(renderNode, anchor);
                          const buttonPoint = outwardPoint(edgePoint, anchor, 21);
                          const isActive = quickAddPreview?.sourceNodeId === renderNode.id && quickAddPreview.anchor === anchor;
                          return (
                            <g
                              key={`quick-add-${anchor}`}
                              data-board-quick-add-handle={anchor}
                              data-active={isActive ? "true" : "false"}
                              className="cursor-pointer"
                              onPointerEnter={() => setQuickAddPreview({ sourceNodeId: renderNode.id, anchor })}
                              onPointerLeave={(event) => handleQuickAddPointerLeave(event, renderNode, anchor)}
                              onPointerDown={(event) => handleQuickAddPointerDown(event, renderNode, anchor)}
                              onPointerMove={(event) => handleQuickAddPointerMove(event, renderNode, anchor)}
                              onPointerUp={(event) => handleQuickAddPointerUp(event, renderNode, anchor)}
                              onClick={(event) => handleQuickAddClick(event, renderNode, anchor)}
                            >
                              <circle cx={buttonPoint.x} cy={buttonPoint.y} r={13} fill="transparent" />
                              {isActive ? (
                                <>
                                  <circle cx={buttonPoint.x} cy={buttonPoint.y} r={10.5} fill="#3370ff" stroke="#ffffff" strokeWidth="1.8" />
                                  <text x={buttonPoint.x} y={buttonPoint.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#ffffff" className="pointer-events-none select-none">
                                    {quickAddSymbol(anchor)}
                                  </text>
                                </>
                              ) : (
                                <>
                                  <circle cx={buttonPoint.x} cy={buttonPoint.y} r={5.2} fill="#eaf1ff" stroke="#ffffff" strokeWidth="2.2" />
                                  <circle cx={buttonPoint.x} cy={buttonPoint.y} r={3.4} fill="#5b8cff" stroke="#3370ff" strokeWidth="0.8" />
                                </>
                              )}
                            </g>
                          );
                        }) : null}
                      </>
                    ) : null}
                  </g>
                );
              })}
              {selectedConnector && canEdit ? (() => {
                const geometry = connectorGeometry(selectedConnector, board.nodes);
                if (!geometry) return null;
                const segmentHandles = connectorSegmentHandles(geometry.points);
                return (
                  <g>
                    {geometry.points.map((point, index) => {
                      const isEndpoint = index === 0 || index === geometry.points.length - 1;
                      return (
                        <circle
                          key={`${selectedConnector.id}-overlay-point-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={isEndpoint ? 4.2 : 3.4}
                          fill="#ffffff"
                          stroke="#3370ff"
                          strokeWidth={isEndpoint ? "1.8" : "1.5"}
                          className={isEndpoint ? "cursor-crosshair" : "cursor-default"}
                          onPointerDown={isEndpoint ? (event) => {
                            event.stopPropagation();
                            hideToolbarDuringDrag();
                            setConnectorEndpointDrag({
                              connectorId: selectedConnector.id,
                              endpoint: index === 0 ? "from" : "to",
                              pointer: point,
                            });
                            setSelectedConnectorId(selectedConnector.id);
                            setSelectedNodeId(null);
                            setHoveredAnchor(null);
                          } : undefined}
                        />
                      );
                    })}
                    {segmentHandles.map((handle) => (
                      <g key={`${selectedConnector.id}-overlay-segment-${handle.segmentIndex}`}>
                        <path
                          d={`M ${handle.start.x} ${handle.start.y} L ${handle.end.x} ${handle.end.y}`}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="12"
                          className={handle.orientation === "horizontal" ? "cursor-ns-resize" : "cursor-ew-resize"}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            beginContinuousInteraction();
                            hideToolbarDuringDrag();
                            setConnectorHandleDrag({
                              connectorId: selectedConnector.id,
                              segmentIndex: handle.segmentIndex,
                              orientation: handle.orientation,
                              points: geometry.points.map((point) => ({ ...point })),
                            });
                            setSelectedConnectorId(selectedConnector.id);
                            setSelectedNodeId(null);
                          }}
                        />
                        <circle
                          cx={handle.x}
                          cy={handle.y}
                          r={3.2}
                          fill="#3370ff"
                          stroke="#ffffff"
                          strokeWidth="1"
                          className={handle.orientation === "horizontal" ? "cursor-ns-resize" : "cursor-ew-resize"}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            beginContinuousInteraction();
                            hideToolbarDuringDrag();
                            setConnectorHandleDrag({
                              connectorId: selectedConnector.id,
                              segmentIndex: handle.segmentIndex,
                              orientation: handle.orientation,
                              points: geometry.points.map((point) => ({ ...point })),
                            });
                            setSelectedConnectorId(selectedConnector.id);
                            setSelectedNodeId(null);
                          }}
                        />
                      </g>
                    ))}
                  </g>
                );
              })() : null}
              {editingConnectorLabel ? (() => {
                const value = editingConnectorLabelText || "";
                const inputWidth = Math.min(220, Math.max(58, value.length * 8 + 28));
                return (
                  <foreignObject
                    x={editingConnectorLabel.position.x - inputWidth / 2}
                    y={editingConnectorLabel.position.y - 15}
                    width={inputWidth}
                    height={30}
                    className="overflow-visible"
                  >
                    <input
                      ref={connectorLabelInputRef}
                      data-board-connector-label-input="true"
                      value={editingConnectorLabelText}
                      placeholder="输入文本"
                      onChange={(event) => setEditingConnectorLabelText(event.target.value)}
                      onBlur={finishConnectorLabelEditing}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          finishConnectorLabelEditing();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          finishConnectorLabelEditing();
                        }
                      }}
                      className="h-[26px] w-full border border-[#5b8cff] bg-white px-1.5 text-center text-[12px] leading-[24px] text-[#1f2329] shadow-[0_2px_8px_rgba(31,35,41,0.12)] outline-none"
                    />
                  </foreignObject>
                );
              })() : null}
              {selectionRect ? (() => {
                const rect = normalizeRect(selectionRect.start, selectionRect.current);
                return (
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill="rgba(79,134,255,0.12)"
                    stroke="#4f86ff"
                    strokeWidth="1.25"
                    strokeDasharray="4 3"
                  />
                );
              })() : null}
              {isMultiSelect && activeMultiSelectionBounds ? (() => {
                const rect = activeMultiSelectionBounds;
                return (
                  <g>
                    <rect
                      x={rect.x - 4}
                      y={rect.y - 4}
                      width={rect.width + 8}
                      height={rect.height + 8}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth="10"
                      className={canEdit ? "cursor-move" : "cursor-default"}
                      onPointerDown={(event) => {
                        if (!canEdit || activeMultiSelectedNodes.length + activeMultiSelectedConnectors.length === 0) return;
                        event.stopPropagation();
                        const point = screenToBoard(event);
                        beginContinuousInteraction();
                        hideToolbarDuringDrag();
                        setDragState({
                          nodeIds: activeMultiSelectedNodes.map((item) => item.id),
                          connectorIds: activeMultiSelectedConnectors.map((item) => item.id),
                          startX: point.x,
                          startY: point.y,
                          nodePositions: Object.fromEntries(board.nodes.filter((item) => activeMultiSelectedNodes.some((selectedNode) => selectedNode.id === item.id)).map((item) => [item.id, { x: item.x, y: item.y }])),
                          connectorWaypoints: Object.fromEntries(board.connectors.filter((item) => activeMultiSelectedConnectors.some((selectedConnector) => selectedConnector.id === item.id) || (activeMultiSelectedNodes.some((selectedNode) => selectedNode.id === item.from.nodeId) && activeMultiSelectedNodes.some((selectedNode) => selectedNode.id === item.to.nodeId))).map((item) => [item.id, item.waypoints.map((point) => ({ ...point }))])),
                        });
                      }}
                    />
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.width}
                      height={rect.height}
                      fill="none"
                      stroke="#3370ff"
                      strokeWidth="1.5"
                    />
                    {[
                      { x: rect.x, y: rect.y },
                      { x: rect.x + rect.width, y: rect.y },
                      { x: rect.x, y: rect.y + rect.height },
                      { x: rect.x + rect.width, y: rect.y + rect.height },
                    ].map((point, index) => (
                      <rect key={`multi-handle-${index}`} x={point.x - 3.5} y={point.y - 3.5} width={7} height={7} rx={1.5} fill="#ffffff" stroke="#3370ff" strokeWidth="1.2" />
                    ))}
                  </g>
                );
              })() : null}
            </g>
          </svg>

          {!shapePaletteOpen && !isTransientToolbarHidden && toolbarPoint && (selectedNode || selectedConnector || isMultiSelect) ? (
            <div
              className="board-floating-toolbar absolute z-50 flex h-10 items-center overflow-visible rounded-[12px] border border-[#dee3ee] bg-white text-xs shadow-[0_8px_24px_rgba(31,35,41,0.14)]"
              style={{ left: toolbarPoint.left, top: toolbarPoint.top }}
              onMouseEnter={() => {
                if (panelHoverTimerRef.current) window.clearTimeout(panelHoverTimerRef.current);
              }}
              onMouseLeave={scheduleCloseToolbarPanel}
            >
              {isMultiSelect ? (
                <>
                  <button type="button" className="flex h-10 items-center gap-1.5 rounded-l-[12px] border-r border-[#eef1f6] px-3 text-[#1f2329] hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("multiFilter")} onClick={() => setActivePanel(activePanel === "multiFilter" ? null : "multiFilter")} title="筛选当前多选集合"><BoardIcon name="sliders" className="h-4 w-4" />筛选</button>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] text-[#1f2329] hover:bg-[#f5f7fb]" onClick={() => moveLayer("front")} title="置顶"><BoardIcon name="stacked" className="h-4 w-4" /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] text-[#1f2329] hover:bg-[#f5f7fb]" onClick={() => moveLayer("back")} title="置底"><BoardIcon name="frame" className="h-4 w-4" /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("multiMore")} onClick={() => setActivePanel(activePanel === "multiMore" ? null : "multiMore")} title="更多"><BoardIcon name="more" className="h-4 w-4" /></button>
                </>
              ) : null}
              {selectedNode ? (
                <>
                  <button type="button" className="grid h-10 w-11 place-items-center rounded-l-[12px] border-r border-[#eef1f6] text-[#1f2329] hover:bg-[#f5f7fb]" title={nodeLabel(selectedNode.type)} onMouseEnter={() => openToolbarPanel("shape")} onClick={() => setActivePanel(activePanel === "shape" ? null : "shape")}><ShapeIcon type={selectedNode.type} className="h-[18px] w-[18px]" /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("fill")} onClick={() => setActivePanel(activePanel === "fill" ? null : "fill")} title="填充色"><span className="h-4 w-4 rounded-full border border-[#c9d0dc]" style={{ background: selectedNode.style.fill === "transparent" ? "repeating-linear-gradient(45deg,#fff,#fff 3px,#e5e7eb 3px,#e5e7eb 6px)" : selectedNode.style.fill }} /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("stroke")} onClick={() => setActivePanel(activePanel === "stroke" ? null : "stroke")} title="边框色"><span className="h-4 w-4 rounded-full border-[3px]" style={{ borderColor: selectedNode.style.stroke }} /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] font-semibold hover:bg-[#f5f7fb]" style={{ color: selectedNode.style.color }} onMouseEnter={() => openToolbarPanel("text")} onClick={() => setActivePanel(activePanel === "text" ? null : "text")} title="文字颜色">A</button>
                  <select value={selectedNode.style.fontSize} onChange={(event) => updateSelectedStyle({ fontSize: Number(event.target.value) })} className="h-10 border-0 border-r border-[#eef1f6] bg-white px-2 text-[#1f2329] outline-none">
                    {[12, 14, 16, 18, 20, 24, 28].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] text-[13px] font-medium hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("textStyle")} onClick={() => setActivePanel(activePanel === "textStyle" ? null : "textStyle")} title="文本样式">A≡</button>
                  <button type="button" className="grid h-10 w-10 place-items-center border-r border-[#eef1f6] hover:bg-[#f5f7fb]" onClick={() => setNotice("评论能力本轮仅保留占位，暂未接入画板对象评论")} title="评论"><BoardIcon name="comment" className="h-4 w-4" /></button>
                  <button type="button" className="grid h-10 w-10 place-items-center hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("more")} onClick={() => setActivePanel(activePanel === "more" ? null : "more")} title="更多"><BoardIcon name="more" className="h-4 w-4" /></button>
                </>
              ) : null}
              {selectedConnector ? (
                <>
                  <button type="button" className="h-9 border-r border-[#eef1f6] px-3 hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("line")} onClick={() => setActivePanel(activePanel === "line" ? null : "line")}>{connectorRoutingLabel(selectedConnector.routingMode)}</button>
                  <button type="button" className="h-9 border-r border-[#eef1f6] px-3 hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("line")} onClick={() => setActivePanel(activePanel === "line" ? null : "line")}>路径</button>
                  <button type="button" className="grid h-9 w-10 place-items-center border-r border-[#eef1f6] hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("stroke")} onClick={() => setActivePanel(activePanel === "stroke" ? null : "stroke")} title="线条颜色"><span className="h-4 w-4 rounded-full" style={{ background: selectedConnector.style.stroke }} /></button>
                  <button type="button" className="grid h-9 w-10 place-items-center border-r border-[#eef1f6] hover:bg-[#f5f7fb]" title="文本" onClick={() => setNotice("连接线文本能力本轮仅保留占位，暂未接入")}><span className="text-[13px] font-medium text-[#1f2329]">+T</span></button>
                  <button type="button" className="grid h-9 w-10 place-items-center hover:bg-[#f5f7fb]" onMouseEnter={() => openToolbarPanel("more")} onClick={() => setActivePanel(activePanel === "more" ? null : "more")} title="更多"><BoardIcon name="more" className="h-4 w-4" /></button>
                </>
              ) : null}
              {activePanel ? (
                <div className="absolute left-0 z-50 min-w-48 overflow-y-auto rounded-[12px] border border-[#e3e7ef] bg-white p-3 text-xs shadow-[0_10px_28px_rgba(31,35,41,0.16)]" style={toolbarPanelStyle} onMouseEnter={() => {
                  if (panelHoverTimerRef.current) window.clearTimeout(panelHoverTimerRef.current);
                }} onMouseLeave={scheduleCloseToolbarPanel}>
                  {activePanel === "multiFilter" ? (
                    <div className="space-y-1">
                      {multiSelectionOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left ${multiSelectionFilter === option.key ? "bg-[#eef3ff] text-[#1456f0]" : "text-[#1f2329] hover:bg-[#f6f8fc]"}`}
                          onClick={() => {
                            setMultiSelectionFilter(option.key);
                            setActivePanel(null);
                          }}
                        >
                          <span>{option.label}</span>
                          <span className="text-[#8b95a5]">{option.count}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {activePanel === "multiMore" ? (
                    <div className="space-y-1">
                      <button type="button" className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[#1f2329] hover:bg-[#f6f8fc]" onClick={() => {
                        duplicateSelected();
                        setActivePanel(null);
                      }}><BoardIcon name="stacked" className="h-4 w-4" />复制</button>
                      <button type="button" className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[#d83931] hover:bg-[#fff1f0]" onClick={() => {
                        deleteSelected();
                        setActivePanel(null);
                      }}><BoardIcon name="delete" className="h-4 w-4" />删除</button>
                    </div>
                  ) : null}
                  {activePanel === "shape" && selectedNode ? (
                    <div className="grid grid-cols-5 gap-2">
                      {SHAPE_ITEMS.map((shape) => <button key={shape.type} type="button" title={shape.label} className={`grid h-8 w-8 place-items-center rounded-[8px] border transition-colors ${selectedNode.type === shape.type ? "border-[#d6e4ff] bg-[#eef3ff] text-[#1456f0]" : "border-transparent text-[#1f2329] hover:border-[#e6ebf5] hover:bg-[#f6f8fc] hover:text-[#1456f0]"}`} onClick={() => {
                        commitBoard((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, type: shape.type } : node) }));
                        setActivePanel(null);
                      }}><ShapeIcon type={shape.type} className="h-[17px] w-[17px]" /></button>)}
                    </div>
                  ) : null}
                  {(activePanel === "fill" || activePanel === "stroke" || activePanel === "text") && selectedNode ? (
                    <div className="grid grid-cols-8 gap-2">
                      {COLOR_SWATCHES.map((color) => <button key={color} type="button" title={color} className="h-5 w-5 rounded-full border border-[#d7dce5]" style={{ background: color === "transparent" ? "repeating-linear-gradient(45deg,#fff,#fff 4px,#e5e7eb 4px,#e5e7eb 8px)" : color }} onClick={() => {
                        if (activePanel === "fill") updateSelectedStyle({ fill: color });
                        if (activePanel === "stroke") updateSelectedStyle({ stroke: color });
                        if (activePanel === "text") updateSelectedStyle({ color });
                        setActivePanel(null);
                      }} />)}
                    </div>
                  ) : null}
                  {activePanel === "textStyle" && selectedNode ? (
                    <div className="w-44 space-y-1">
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedStyle({ fontWeight: selectedNode.style.fontWeight === 600 ? 400 : 600 })}>
                        {selectedNode.style.fontWeight === 600 ? "取消加粗" : "加粗"}
                      </button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedStyle({ textAlign: "left" })}>左对齐</button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedStyle({ textAlign: "center" })}>居中</button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedStyle({ textAlign: "right" })}>右对齐</button>
                    </div>
                  ) : null}
                  {activePanel === "stroke" && selectedConnector ? (
                    <div className="grid grid-cols-8 gap-2">
                      {COLOR_SWATCHES.filter((color) => color !== "transparent").map((color) => <button key={color} type="button" className="h-5 w-5 rounded-full border border-[#d7dce5]" style={{ background: color }} onClick={() => {
                        updateSelectedConnector({ style: { stroke: color } });
                        setActivePanel(null);
                      }} />)}
                    </div>
                  ) : null}
                  {activePanel === "line" && selectedConnector ? (
                    <div className="w-52 space-y-2">
                      <div className="space-y-1">
                        <div className="px-2 text-[11px] text-[#8a9099]">路由模式</div>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => setSelectedConnectorRouting("straight")}>直线</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => setSelectedConnectorRouting("orthogonal")}>直角折线</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => setSelectedConnectorRouting("polyline")}>多段折线</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => setSelectedConnectorRouting("rounded-orthogonal")}>圆角折线</button>
                      </div>
                      <div className="space-y-1 border-t border-[#eef1f6] pt-2">
                        <div className="px-2 text-[11px] text-[#8a9099]">线条样式</div>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { strokeWidth: 1 } })}>细线 ─</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { strokeWidth: 2 } })}>中线 ━</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { strokeDasharray: selectedConnector.style.strokeDasharray ? "" : "6 4" } })}>实线 / 虚线</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { endArrow: selectedConnector.style.endArrow === "arrow" ? "none" : "arrow" } })}>终点箭头 →</button>
                        <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { startArrow: selectedConnector.style.startArrow === "arrow" ? "none" : "arrow" } })}>起点箭头 ←</button>
                        {selectedConnector.routingMode === "rounded-orthogonal" ? (
                          <>
                            <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { cornerRadius: 8 } })}>圆角半径 8</button>
                            <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { cornerRadius: 12 } })}>圆角半径 12</button>
                            <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => updateSelectedConnector({ style: { cornerRadius: 18 } })}>圆角半径 18</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {activePanel === "more" && selectedNode ? (
                    <div className="w-44">
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => setClipboardNode(structuredClone(selectedNode))}>复制</button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => { setClipboardNode(structuredClone(selectedNode)); deleteSelected(); }}>剪切</button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={duplicateSelected}>创建副本</button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => moveLayer("front")}>置于顶层</button>
                      <button type="button" className="block h-8 w-full px-2 text-left hover:bg-[#f5f7fb]" onClick={() => moveLayer("back")}>置于底层</button>
                      <button type="button" className="block h-8 w-full px-2 text-left text-[#d83931] hover:bg-[#fff1f0]" onClick={deleteSelected}>删除</button>
                    </div>
                  ) : null}
                  {activePanel === "more" && selectedConnector ? (
                    <div className="w-40">
                      <button type="button" className="block h-8 w-full px-2 text-left text-[#d83931] hover:bg-[#fff1f0]" onClick={deleteSelected}>删除连线</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="absolute bottom-4 right-4 flex h-8 items-center overflow-hidden border border-[#dee3ee] bg-white text-xs shadow-[0_2px_10px_rgba(31,35,41,0.08)]">
            <button type="button" onClick={() => zoom(-0.1)} disabled={!canEdit} className="h-8 w-8 border-r border-[#eef1f6] disabled:opacity-40">-</button>
            <span className="w-14 text-center text-[#646a73]">{Math.round(board.viewport.zoom * 100)}%</span>
            <button type="button" onClick={() => zoom(0.1)} disabled={!canEdit} className="h-8 w-8 border-l border-[#eef1f6] disabled:opacity-40">+</button>
          </div>
          {notice ? <div className="absolute left-[76px] top-16 z-40 border border-[#dee3ee] bg-white px-3 py-2 text-sm text-[#646a73] shadow-[0_2px_10px_rgba(31,35,41,0.08)]">{notice}</div> : null}
        </section>
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="确认删除画板"
        description={`删除后「${currentDocument.title}」会进入删除流程。确认删除吗？`}
        confirmLabel="删除"
        danger
        pending={isMutating}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteDocument}
      />
    </div>
  );
}
