import { Connection, is_SongInfo } from "./connection"
import { download_video, get_video_meta, SONGINFO_STASH } from "./song_loader"
import { PlayState, SongInfo } from "./connection_types"

export class Player {
    readonly connections = new Set<Connection>()
    readonly queue: string[] = []
    current_song: string | null = null
    current_song_discriminator: number = 0
    playstate: PlayState = { playing: false, time_at: 0, rate: 1 }
    volume: number = 1.0

    async req_enqueue(song_id: string) {
        const cached = SONGINFO_STASH.data.get(song_id)
        if (cached == null || cached.deleted || cached.failed) {
            const song_info: SongInfo & { format?: "webm" | "mp4" } = { title: song_id, uploader: "...", loaded: false, failed: false, deleted: false, length: -1 }
            this.connections.forEach(v => (
                v.send_songinfo(song_id, song_info)
            ))
            SONGINFO_STASH.data.set(song_id, song_info)
            const { title, uploader, length } = await get_video_meta(song_id) ?? { title: "<missing title>", uploader: "<missing author>", length: -1 }
            song_info.title = title
            song_info.uploader = uploader
            song_info.length = length
            this.connections.forEach(v => (
                v.send_songinfo(song_id, song_info)
            ))
            SONGINFO_STASH.save()
            const format = await download_video(song_id)
            if (format == null) {
                song_info.failed = true
            } else {
                song_info.loaded = true
                song_info.format = format
            }
            this.connections.forEach(v => (
                v.send_songinfo(song_id, song_info)
            ))
            SONGINFO_STASH.save()
            if (song_info.failed) return
            this.queue.push(song_id)
            this.connections.forEach(v => (
                v.send_queue_change(this.queue)
            ))
            if (this.current_song === null) {
                this.shift_queue()
            }
        } else if (cached.loaded) {
            this.queue.push(song_id)
            this.connections.forEach(v => (
                v.send_queue_change(this.queue)
            ))
            if (this.current_song === null) {
                this.shift_queue()
            }
        } else {
            // this will ignore if trying to double queue something before its finished downloading
        }
    }
    async req_skip() {
        this.shift_queue()
    }
    /// from_id is used to make skips idempotent
    async req_next(from_discriminator: number) {
        if (this.current_song_discriminator === from_discriminator) {
            this.shift_queue()
        }
    }
    async req_playstate(playstate: PlayState) {
        this.set_playstate(playstate)
    }
    async req_volume(volume: number) {
        this.volume = Math.min(Math.max(volume, 0.0), 1.0)
        this.connections.forEach(v => {
            v.send_volume(this.volume)
        })
    }
    async req_queuechange(new_queue: string[]) {
        this.queue.splice(0, Infinity, ...new_queue.filter(id => SONGINFO_STASH.data.has(id)))
    }

    private set_playstate(new_playstate: PlayState) {
        this.playstate = new_playstate
        this.connections.forEach(v => {
            v.send_playstate(this.playstate)
        })
    }
    private shift_queue() {
        this.current_song = this.queue.shift() ?? null
        this.current_song_discriminator = (
            this.current_song_discriminator
        ) | 0 // modulo 4.3 billion
        this.connections.forEach(v => {
            v.send_video_change(this.current_song, this.current_song_discriminator)
            v.send_queue_change(this.queue)
        })
        this.set_playstate(this.playstate.playing ? {
            playing: true, time_start: Date.now(), rate: this.playstate.rate,
        } : {
            playing: false, time_at: 0, rate: this.playstate.rate,
        })
    }

    sync_connection(conn: Connection) {
        for (const [id, info] of SONGINFO_STASH.data) {
            conn.send_songinfo(id, info)
        }
        conn.send_volume(this.volume)
        conn.send_queue_change(this.queue)
        conn.send_video_change(this.current_song, this.current_song_discriminator)
        conn.send_playstate(this.playstate)
    }

    readonly until_setup = this.setup()
    private async setup() {
        const changed_ids = await Promise.all([...SONGINFO_STASH.data.entries()].map(([id, v]: [string, unknown]) => {
            if (is_SongInfo(v)) {
                return null
            } else {
                return (async () => {
                    const meta = await get_video_meta(id)
                    SONGINFO_STASH.data.set(id, meta === null ? typeof v === "object" && v != null ? {
                        ...v,
                        title: "title" in v && typeof v.title === "string" ? v.title : "<failed>",
                        uploader: "uploader" in v && typeof v.uploader === "string" ? v.uploader : "<failed>",
                        deleted: "deleted" in v && typeof v.deleted === "boolean" ? v.deleted : false,
                        loaded: "loaded" in v && typeof v.loaded === "boolean" ? v.loaded : false,
                        length: "length" in v && typeof v.length === "number" ? v.length : -1,
                        failed: true,
                        ... "format" in v && (v.format === "mp4" || v.format === "webm") ? { format: v.format } : null
                    } : {
                        title: "<failed>",
                        uploader: "<failed>",
                        deleted: false,
                        loaded: false,
                        failed: true,
                        length: -1,
                    } : typeof v === "object" && v != null ? {
                        deleted: true,
                        loaded: false,
                        failed: false,
                        ...(
                            "deleted" in v && (typeof v.deleted === "boolean") &&
                                "loaded" in v && (typeof v.loaded === "boolean") &&
                                "failed" in v && (typeof v.failed === "boolean")
                                ? v as { deleted: boolean, loaded: boolean, failed: boolean } : null),
                        title: meta.title,
                        uploader: meta.uploader,
                        length: meta.length,
                    } : {
                        title: meta.title,
                        uploader: meta.uploader,
                        deleted: true,
                        loaded: false,
                        failed: false,
                        length: meta.length,
                    })
                    return id
                })()
            }
        }).filter(v => v != null))
        const updated_metas = changed_ids.map(id => [id, SONGINFO_STASH.data.get(id)!] satisfies [string, SongInfo])

        this.connections.forEach(conn => {
            for (const [id, info] of updated_metas) {
                conn.send_songinfo(id, info)
            }
        })
    }
}