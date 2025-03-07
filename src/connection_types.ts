export interface SongInfo {
    title: string,
    uploader: string,
    loaded: boolean,
    failed: boolean,
    deleted: boolean,
    length: number,
}
export type PlayState = {
    playing: true,
    time_start: number,
    rate: number,
} | {
    playing: false,
    time_at: number,
    rate: number,
}

export const CMSG_KEY = {
    VIDEO_CHANGE: "c",
    PLAY_STATE: "p",
    VOLUME: "v",
    QUEUE_CHANGED: "q",
    SONG_INFO: "i",
    PING: "_",
} as const
export const SMSG_KEY = {
    ENQUEUE: "e",
    QUEUE_CHANGE: "q",
    PLAY_STATE: "p",
    SKIP: "k",
    NEXT: "n",
    VOLUME: "v",
    REQ_SYNC: "y",
    PING: "_",
} as const

export type CMsgVideoChange = [typeof CMSG_KEY.VIDEO_CHANGE, string | null, number]
export type CMsgPlayState = [typeof CMSG_KEY.PLAY_STATE, PlayState]
export type CMsgVolume = [typeof CMSG_KEY.VOLUME, number]
export type CMsgQueueChange = [typeof CMSG_KEY.QUEUE_CHANGED, string[]]
export type CMsgSongInfo = [typeof CMSG_KEY.SONG_INFO, string, SongInfo]
/// [_, /* time that the ping was sent from the client */, /* time that the ping bounced off the server */ ]
export type CMsgPing = [typeof CMSG_KEY.PING, number, number]
export type CMsg = CMsgVideoChange | CMsgPlayState | CMsgVolume | CMsgQueueChange | CMsgSongInfo | CMsgPing


export type SMsgEnqueue = [typeof SMSG_KEY.ENQUEUE, string]
export type SMsgSkip = [typeof SMSG_KEY.SKIP]
export type SMsgNext = [typeof SMSG_KEY.NEXT, number]
export type SMsgPlayState = [typeof SMSG_KEY.PLAY_STATE, PlayState]
export type SMsgVolume = [typeof SMSG_KEY.VOLUME, number]
export type SMsgQueueChange = [typeof SMSG_KEY.QUEUE_CHANGE, string[]]
export type SMsgReqSync = [typeof SMSG_KEY.REQ_SYNC]
/// [_, /* time that the ping was sent from client */ ]
export type SMsgPing = [typeof SMSG_KEY.PING, number]
export type SMsg = SMsgEnqueue | SMsgSkip | SMsgNext | SMsgPlayState | SMsgVolume | SMsgQueueChange | SMsgReqSync | SMsgPing
