import { SongInfo, SMsg, SMsgEnqueue, SMsgVolume, SMsgQueueChange, SMSG_KEY, SMsgSkip, CMSG_KEY, CMsg, SMsgReqSync, SMsgNext, PlayState, SMsgPlayState, SMsgPing } from "./connection_types";
import { WebSocket } from "ws"
import { is_arr, is_bool, is_dict, is_in_union, is_literal, is_number, is_str, is_tuple, try_parse_json } from "./json";
import { Player } from "./player";

export const is_SongInfo = is_dict({
    title: is_str,
    uploader: is_str,
    loaded: is_bool,
    failed: is_bool,
    deleted: is_bool,
    length: is_number,
}) as (v: unknown) => v is SongInfo

const is_PlayState = is_in_union<PlayState>([
    is_dict({
        playing: is_literal<true>(true),
        time_start: is_number,
        rate: is_number,
    }),
    is_dict({
        playing: is_literal<false>(false),
        time_at: is_number,
        rate: is_number,
    }),
]) as (v: unknown) => v is PlayState

const is_msg_video_change = is_tuple<SMsgEnqueue>([is_literal(SMSG_KEY.ENQUEUE), is_str])
const is_msg_skip = is_tuple<SMsgSkip>([is_literal(SMSG_KEY.SKIP)])
const is_msg_next = is_tuple<SMsgNext>([is_literal(SMSG_KEY.NEXT), is_number])
const is_msg_playstate = is_tuple<SMsgPlayState>([is_literal(SMSG_KEY.PLAY_STATE), is_PlayState])
const is_msg_volume = is_tuple<SMsgVolume>([is_literal(SMSG_KEY.VOLUME), is_number])
const is_msg_queue_change = is_tuple<SMsgQueueChange>([is_literal(SMSG_KEY.QUEUE_CHANGE), is_arr(is_str)])
const is_msg_req_sync = is_tuple<SMsgReqSync>([is_literal(SMSG_KEY.REQ_SYNC)])
const is_msg_ping = is_tuple<SMsgPing>([is_literal(SMSG_KEY.PING), is_number])
const is_msg = is_in_union<SMsg>(
    [is_msg_video_change, is_msg_skip, is_msg_next, is_msg_playstate, is_msg_volume, is_msg_queue_change, is_msg_req_sync, is_msg_ping]
)

export class Connection {
    private readonly on_message = (raw_data: string) => {
        const data = try_parse_json(raw_data, is_msg)
        if (data == null) {
            console.warn("received invalid message", raw_data)
            return
        }
        switch (data[0]) {
            case SMSG_KEY.ENQUEUE:
                this.player.req_enqueue(data[1])
                break
            case SMSG_KEY.SKIP:
                this.player.req_skip()
                break
            case SMSG_KEY.NEXT:
                this.player.req_next(data[1])
                break
            case SMSG_KEY.PLAY_STATE:
                this.player.req_playstate(data[1])
                break
            case SMSG_KEY.VOLUME:
                this.player.req_volume(data[1])
                break
            case SMSG_KEY.QUEUE_CHANGE:
                this.player.req_queuechange(data[1])
                break
            case SMSG_KEY.REQ_SYNC:
                this.player.sync_connection(this)
                break
            case SMSG_KEY.PING: {
                this.send([CMSG_KEY.PING, data[1], Date.now()])
                break
            }
        }
    }

    send(msg: CMsg) {
        this.ws.send(JSON.stringify(msg))
    }

    send_video_change(id: string | null, discriminator: number) { this.send([CMSG_KEY.VIDEO_CHANGE, id, discriminator]) }
    send_playstate(playstate: PlayState) { this.send([CMSG_KEY.PLAY_STATE, playstate]) }
    send_volume(volume: number) { this.send([CMSG_KEY.VOLUME, volume]) }
    send_queue_change(new_queue: string[]) { this.send([CMSG_KEY.QUEUE_CHANGED, new_queue]) }
    send_songinfo(id: string, songinfo: SongInfo) { this.send([CMSG_KEY.SONG_INFO, id, songinfo]) }


    constructor(
        readonly ws: WebSocket,
        private readonly player: Player,
    ) {
        ws.on("message", this.on_message)
    }
    drop() {
        this.ws.close()
    }
}
