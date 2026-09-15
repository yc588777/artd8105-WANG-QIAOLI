export type Lang = "zh" | "en";
export type Theme = "lab" | "archive";
export type LabMode = "learn" | "experiment" | "analyze";

export type ModuleId =
  | "index"
  | "gene"
  | "flock"
  | "cell"
  | "grow"
  | "diff"
  | "hybrid"
  | "archive"
  | "about";

export type LabId = "gene" | "flock" | "cell" | "grow" | "diff" | "hybrid";

export type ArchiveEntry = {
  id: string;
  module: LabId;
  seed: number;
  createdAt: number;
  params: unknown;
  thumbnail: string;
  challenge?: string;
  title: string;
};
