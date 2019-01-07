interface IGeneral {
  [key: string]: string | number;
  AudioFilename: string;
  AudioLeadIn: number;
  PreviewTime: number;
  Countdown: number;
  SampleSet: LegacySampleBank;
  StackLeniency: number;
  Mode: number;
  LetterboxInBreaks: number;
  WidescreenStoryboard: number;
}
interface IDifficulty {
  [key: string]: number;
  HPDrainRate: number;
  CircleSize: number;
  OverallDifficulty: number;
  ApproachRate: number;
}
interface ITimingPoint {
  Time: number;
  BeatLength?: number;
  TimeSignature?: TimeSignatures;
  SpeedMultiplier: number;
  KiaiMode: boolean;
  OmitFirstBarLine: boolean;
  SampleBank: string;
  SampleVolume: number;
  CustomSampleBank: number;
}
interface IHitObject {
  Combo?: boolean;
  ComboOffset?: number;
  Points?: IVector2D[];
  Length?: number;
  PathType?: PathType;
  RepeatCount?: number;
  NodeSamples?: ISampleInfo[][];
  Samples?: ISampleInfo[];
  StartTime?: number;
  Pos?: IVector2D;
}
interface IVector2D {
  x: number;
  y: number;
}
interface ISampleBankInfo {
  Filename?: string;
  Normal?: string;
  Add?: string;
  Volume?: number;
  CustomSampleBank?: number;
}
interface ISampleInfo {
  Filename?: string;
  Bank?: string;
  Name?: string;
  Volume?: number;
  CustomSampleBank?: number;
}

enum TimeSignatures {
  SimpleQuadruple = 4,
  SimpleTriple = 3,
}
enum LegacySampleBank {
  None = 0,
  Normal = 1,
  Soft = 2,
  Drum = 3,
}
enum EffectFlags {
  None = 0,
  Kiai = 1,
  OmitFirstBarLine = 8,
}
enum ConvertHitObjectType {
  Circle = 1 << 0,
  Slider = 1 << 1,
  NewCombo = 1 << 2,
  Spinner = 1 << 3,
  ComboOffset = 1 << 4 | 1 << 5 | 1 << 6,
  Hold = 1 << 7,
}
enum LegacySoundType {
  None = 0,
  Normal = 1,
  Whistle = 2,
  Finish = 4,
  Clap = 8,
}
enum PathType {
  Catmull,
  Bezier,
  Linear,
  PerfectCurve,
}

class OsuParser {
  public currentSection: string;
  public general: IGeneral;
  public difficulty: IDifficulty;
  public timingPoints: ITimingPoint[];
  public hitObjects: IHitObject[];

  constructor() {
    this.currentSection = "";
    this.general = {
      AudioFilename: "",
      AudioLeadIn: 0,
      Countdown: 0,
      LetterboxInBreaks: 0,
      Mode: 0,
      PreviewTime: 0,
      SampleSet: LegacySampleBank.None,
      StackLeniency: 0,
      WidescreenStoryboard: 0,
    };
    this.difficulty = {
      ApproachRate: 0,
      CircleSize: 0,
      HPDrainRate: 0,
      OverallDifficulty: 0,
    };
    this.timingPoints = [];
    this.hitObjects = [];
  }

  public parse(line: string) {
    if (line.startsWith("[")) {
      this.parseSection(line);
    } else {
      this.parseLine(line);
    }
  }
  public toJSON() {
    return {
      general: this.general,
      difficulty: this.difficulty,
      timingPoints: this.timingPoints,
      hitObjects: this.hitObjects,
    };
  }

  private parseSection(line: string) {
    const result = /\[([\w\d]+)\]/g.exec(line);
    if (result) {
      this.currentSection = result[1];
    }
  }

  private parseLine(line: string) {
    const parsers = {
      General: parseGeneral(this),
      Difficulty: parseDifficulty(this),
      TimingPoints: parseTimingPoint(this),
      HitObjects: parseHitObjects(this),
    } as {[key: string]: any};

    const parser = parsers[this.currentSection] ? parsers[this.currentSection] : () => null;
    parser(line);
  }
}

const parseGeneral = (parser: OsuParser) => (line: string) => {
  const general = parser.general;
  const split = line.split(":").map((str) => str.trim());
  if (split.length === 2) {
    const [key, value] = split;
    const num = Number(value);
    if (key === "SampleSet") {
      general[key] = LegacySampleBank[value as keyof typeof LegacySampleBank];
    } else {
      general[key] = Number.isNaN(num) ? value : num;
    }
  }
};
const parseDifficulty = (parser: OsuParser) => (line: string) => {
  const difficulty = parser.difficulty;
  const split = line.split(":").map((str) => str.trim());
  if (split.length === 2) {
    const [key, value] = split;
    difficulty[key] = Number(value);
  }
};
const parseTimingPoint = (parser: OsuParser) => (line: string) => {
  const {timingPoints, general: {SampleSet: defaultSampleSet}} = parser;
  const split = line.split(",").map((str) => str.trim());
  if (split.length < 2) {
    return;
  }

  const time = Number(split[0].trim());
  const beatLength = Number(split[1].trim());
  const speedMultiplier = beatLength < 0 ? 100.0 / -beatLength : 1;

  let timeSignature = TimeSignatures.SimpleQuadruple;
  if (split.length >= 3) {
    timeSignature = split[2][0] === "0" ? TimeSignatures.SimpleQuadruple : Number(split[2]);
  }

  let sampleSet = defaultSampleSet;
  if (split.length >= 4) {
      sampleSet = Number(split[3]);
  }

  let customSampleBank = 0;
  if (split.length >= 5) {
    customSampleBank = Number(split[4]);
  }

  let sampleVolume = 100;
  if (split.length >= 6) {
    sampleVolume = Number(split[5]);
  }

  let timingChange = true;
  if (split.length >= 7) {
    timingChange = split[6][0] === "1";
  }

  let kiaiMode = false;
  let omitFirstBarSignature = false;
  if (split.length >= 8) {
    const effectFlags = Number(split[7]);
    kiaiMode = Boolean(effectFlags & EffectFlags.Kiai);
    omitFirstBarSignature = Boolean(effectFlags & EffectFlags.OmitFirstBarLine);
  }

  let stringSampleSet = LegacySampleBank[sampleSet].toLowerCase();
  if (stringSampleSet === "none") {
    stringSampleSet = "normal";
  }

  const timingPoint: ITimingPoint = {
    Time: time,
    SpeedMultiplier: speedMultiplier,
    KiaiMode: kiaiMode,
    OmitFirstBarLine: omitFirstBarSignature,
    SampleBank: stringSampleSet,
    SampleVolume: sampleVolume,
    CustomSampleBank: customSampleBank,
  };
  if (timingChange) {
    timingPoint.BeatLength = beatLength;
    timingPoint.TimeSignature = timeSignature;
  }

  timingPoints.push(timingPoint);
};
const parseHitObjects = (parser: OsuParser) => (line: string) => {
  const {hitObjects} = parser;
  const split = line.split(",").map((str) => str.trim());

  const pos: IVector2D = {x: Number(split[0]), y: Number(split[1])};

  let type: ConvertHitObjectType = Number(split[3]);

  const comboOffset = Number(type & ConvertHitObjectType.ComboOffset) >> 4;
  type &= ~ConvertHitObjectType.ComboOffset;

  const combo = Boolean(type & ConvertHitObjectType.NewCombo);
  type &= ~ConvertHitObjectType.NewCombo;

  const soundType: LegacySoundType = Number(split[4]);
  const bankInfo: ISampleBankInfo = {};

  const result: IHitObject = {};

  if ((type & ConvertHitObjectType.Circle)) {
    result.Pos = pos;
    result.Combo = combo;
    result.ComboOffset = comboOffset;

    if (split.length > 5) {
      readCustomSampleBanks(split[5], bankInfo);
    }
  } else if ((type & ConvertHitObjectType.Slider)) {
    let pathType = PathType.Catmull;
    let length = 0;

    const [ptype, ...pointSplit] = split[5].split("|").map((str) => str.trim());
    switch (ptype) {
      case "C":
        pathType = PathType.Catmull;
        break;
      case "B":
        pathType = PathType.Bezier;
        break;
      case "L":
        pathType = PathType.Linear;
        break;
      case "P":
        pathType = PathType.PerfectCurve;
        break;
    }

    const points: IVector2D[] = [];

    pointSplit.forEach((t) => {
      const temp = t.split(":").map((str) => str.trim());
      points.push({x: Number(temp[0]), y: Number(temp[1])});
    });

      // osu-stable special-cased colinear perfect curves to a CurveType.Linear
    const isLinear = (p: IVector2D[]) =>
      Math.abs(0 - (p[1].y - p[0].y) * (p[2].x - p[0].x) - (p[1].x - p[0].x) * (p[2].y - p[0].y)) <= 0.001;

    if (points.length === 3 && pathType === PathType.PerfectCurve && isLinear(points)) {
      pathType = PathType.Linear;
    }

    let repeatCount = Number(split[6]);

    if (repeatCount > 9000) {
      throw new Error("Repeat count is way too high");
    }
    // osu-stable treated the first span of the slider as a repeat, but no repeats are happening
    repeatCount = Math.max(0, repeatCount - 1);

    if (split.length > 7) {
      length = Number(split[7]);
    }

    if (split.length > 10) {
      readCustomSampleBanks(split[10], bankInfo);
    }

    // One node for each repeat + the start and end nodes
    const nodes = repeatCount + 2;

    // Populate node sample bank infos with the default hit object sample bank
    const nodeBankInfos: ISampleBankInfo[] = [];
    for (let i = 0; i < nodes; i++) {
      nodeBankInfos.push({...bankInfo});
    }

    // Read any per-node sample banks
    if (split.length > 9 && split[9].length > 0) {
      const sets = split[9].split("|").map((str) => str.trim());
      for (let i = 0; i < nodes; i++) {
        if (i >= sets.length) {
          break;
        }
        const info: ISampleBankInfo = nodeBankInfos[i];
        readCustomSampleBanks(sets[i], info);
      }
    }

    // Populate node sound types with the default hit object sound type
    const nodeSoundTypes: LegacySoundType[] = [];
    for (let i = 0; i < nodes; i++) {
      nodeSoundTypes.push(soundType);
    }

    // Read any per-node sound types
    if (split.length > 8 && split[8].length > 0) {
      const adds = split[8].split("|").map((str) => str.trim());
      for (let i = 0; i < nodes; i++) {
        if (i >= adds.length) {
          break;
        }

        const sound = Number.isNaN(Number(adds[i])) ? 0 : Number(adds[i]);
        nodeSoundTypes[i] = sound;
      }
    }

    // Generate the final per-node samples
    const nodeSamples: ISampleInfo[][] = [];
    for (let i = 0; i < nodes; i++) {
      nodeSamples.push(convertSoundType(nodeSoundTypes[i], nodeBankInfos[i]));
    }

    result.Pos = pos;
    result.Combo = combo;
    result.ComboOffset = comboOffset;
    result.Points = points;
    result.Length = length;
    result.PathType = pathType;
    result.RepeatCount = repeatCount;
    result.NodeSamples = nodeSamples;

    // The samples are played when the slider ends, which is the last node
    result.Samples = nodeSamples[nodeSamples.length - 1];
  } else if ((type & ConvertHitObjectType.Spinner)) {
    /**/
  } else if ((type & ConvertHitObjectType.Hold)) {
    /**/
  }

  if (Object.keys(result).length === 0) {
    return;
  }

  const offset = 0;
  result.StartTime = Number(split[2]) + offset;

  if (!result.Samples) {
    result.Samples = convertSoundType(soundType, bankInfo);
  }
  hitObjects.push(result);

  return;
};

function readCustomSampleBanks(line: string, bankInfo: ISampleBankInfo) {
  const split = line.split(":").map((str) => str.trim());

  const bank: LegacySampleBank = Number(split[0]);
  const addbank: LegacySampleBank = Number(split[1]);

  let stringBank: string|undefined = LegacySampleBank[bank].toLowerCase();
  if (stringBank === "none") {
    stringBank = undefined;
  }
  let stringAddBank: string|undefined = LegacySampleBank[addbank].toLowerCase();
  if (stringAddBank === "none") {
    stringAddBank = undefined;
  }

  bankInfo.Normal = stringBank;
  bankInfo.Add = stringAddBank === "" ? stringBank : stringAddBank;

  if (split.length > 2) {
    bankInfo.CustomSampleBank = Number(split[2]);
  }

  if (split.length > 3) {
    bankInfo.Volume = Number(split[3]);
  }

  bankInfo.Filename = split.length > 4 ? split[4] : undefined;
}

function convertSoundType(type: LegacySoundType, bankInfo: ISampleBankInfo): ISampleInfo[] {
  // Todo: This should return the normal SampleInfos
  // if the specified sample file isn't found, but that's a pretty edge-case scenario
  if (bankInfo.Filename && bankInfo.Filename !== "") {
    return [ { Filename: bankInfo.Filename } ];
  }

  const soundTypes: ISampleInfo[] = [{
    Bank: bankInfo.Normal,
    Name: "hitnormal",
    Volume: bankInfo.Volume,
    CustomSampleBank: bankInfo.CustomSampleBank,
  }];

  if (type & LegacySoundType.Finish) {
    soundTypes.push({
      Bank: bankInfo.Add,
      Name: "hitfinish",
      Volume: bankInfo.Volume,
      CustomSampleBank: bankInfo.CustomSampleBank,
    });
  }

  if (type & LegacySoundType.Whistle) {
    soundTypes.push({
      Bank: bankInfo.Add,
      Name: "hitwhistle",
      Volume: bankInfo.Volume,
      CustomSampleBank: bankInfo.CustomSampleBank,
    });
  }

  if (type & LegacySoundType.Clap) {
    soundTypes.push({
      Bank: bankInfo.Add,
      Name: "hitclap",
      Volume: bankInfo.Volume,
      CustomSampleBank: bankInfo.CustomSampleBank,
    });
  }

  return soundTypes;
}

export default OsuParser;
