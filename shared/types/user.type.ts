export interface UserLocationData {
  map: string;
  x: number;
  y: number;
}

export interface UserAvatarData {
  skin: number;
  eye: number;
  hair: number;
  top: number;
  bottom: number;
  shoes: number;
  etc_1: number;
  etc_2: number;
  etc_3: number;
}

export interface UserPcSettingsData {
  background: [number, number][]; // [[boxId, backgroundId], ...]
  name: [number, string][]; // [[boxId, "BoxName"], ...]
}

export enum UserAuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  DISCORD = 'discord',
}
