import type { ExplorationEncounterId, WorldDiscoveryId } from "./exploration-engine";

export type Point3 = readonly [x: number, y: number, z: number];

export type LevelEncounterNode = {
  id: ExplorationEncounterId;
  position: Point3;
  triggerRadius: number;
};

export type LevelDiscoveryNode = {
  id: WorldDiscoveryId;
  position: Point3;
  triggerRadius: number;
};

export type LevelPalette = {
  sky: string;
  fog: string;
  ground: string;
  path: string;
  foliage: string;
  accent: string;
};

export type PlayCanvasLevelDefinition = {
  schemaVersion: 1;
  id: string;
  title: string;
  subtitle: string;
  spawn: Point3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  camera: { distance: number; height: number; lookAhead: number };
  palette: LevelPalette;
  encounters: readonly LevelEncounterNode[];
  discoveries: readonly LevelDiscoveryNode[];
  checkpoints: readonly { z: number; message: string }[];
  endless: {
    chunkLength: number;
    visibleChunks: number;
    recycleBehind: number;
  };
};

export const BLOSSOM_TRAIL_LEVEL = {
  schemaVersion: 1,
  id: "blossom-trail-pc",
  title: "樱花谷自然步道",
  subtitle: "PlayCanvas 数据化探索样板",
  spawn: [0, 0.58, 5.5],
  bounds: { minX: -9.5, maxX: 9.5, minZ: -31, maxZ: 7 },
  camera: { distance: 6.4, height: 3.1, lookAhead: 1.7 },
  palette: {
    sky: "#8aa79e",
    fog: "#b8c4ba",
    ground: "#496b50",
    path: "#8b8579",
    foliage: "#315943",
    accent: "#c6a77d",
  },
  encounters: [
    { id: "rune-gate", position: [0, 0, -3.6], triggerRadius: 2.15 },
    { id: "moon-bridge", position: [0, 0, -13.2], triggerRadius: 2.25 },
    { id: "wish-beacon", position: [0, 0, -23.1], triggerRadius: 2.35 },
  ],
  discoveries: [
    { id: "momo-guide", position: [-5.1, 0, -6.7], triggerRadius: 1.45 },
    { id: "dew-crystal", position: [5.4, 0, -11.4], triggerRadius: 1.55 },
    { id: "tea-gardener", position: [5.7, 0, -18.5], triggerRadius: 1.5 },
    { id: "cloud-seed", position: [-5.8, 0, -21.3], triggerRadius: 1.6 },
  ],
  checkpoints: [
    { z: -8.4, message: "已到达林间石桥，进度会从这里继续" },
    { z: -18.2, message: "已到达湖岸步道，前方是最后一个打字任务" },
  ],
  endless: { chunkLength: 24, visibleChunks: 7, recycleBehind: 2 },
} as const satisfies PlayCanvasLevelDefinition;

export function validateLevelDefinition(level: PlayCanvasLevelDefinition) {
  const encounterIds = new Set(level.encounters.map((node) => node.id));
  const discoveryIds = new Set(level.discoveries.map((node) => node.id));
  const validBounds = level.bounds.minX < level.bounds.maxX && level.bounds.minZ < level.bounds.maxZ;
  const validNodes = [...level.encounters, ...level.discoveries].every((node) => node.position.length === 3 && node.triggerRadius > 0);
  return {
    valid: level.schemaVersion === 1 && validBounds && validNodes && encounterIds.size === level.encounters.length && discoveryIds.size === level.discoveries.length,
    encounterCount: encounterIds.size,
    discoveryCount: discoveryIds.size,
  };
}
