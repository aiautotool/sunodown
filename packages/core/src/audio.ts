export type AudioOutputFormat = 'mp3' | 'wav' | 'm4a';
export type SpatialMode = 'wide' | 'immersive' | 'orbit';

export type AudioAsset = {
  uri:string;
  mimeType?:string;
  bytes?:Uint8Array;
};

export type AudioEngine = {
  master(source:AudioAsset, options:Record<string,unknown>):Promise<AudioAsset>;
  spatial(source:AudioAsset, amount:number, mode:SpatialMode):Promise<AudioAsset>;
  convert(source:AudioAsset, format:AudioOutputFormat):Promise<AudioAsset>;
};

export type AudioEngineCapabilities = {
  localMastering:boolean;
  localSpatial:boolean;
  localMp3:boolean;
  localWav:boolean;
  localM4a:boolean;
};
