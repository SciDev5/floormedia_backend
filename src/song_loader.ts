import { exec, ChildProcess } from "child_process";
import { SongInfo } from "./connection_types";
import { readFileSync, constants } from "fs";
import { writeFile, access } from "fs/promises";



async function async_join(proc: ChildProcess): Promise<boolean> {
    return new Promise(res => {
        proc.once("error", () => res(false))
        proc.once("exit", (code) => res((code ?? 0) === 0))
        proc.stdout?.pipe(process.stdout)
    })
}
async function async_join_text(proc: ChildProcess): Promise<string> {
    return new Promise(res => {
        let data = ""
        proc.stdout?.on("data", data_chunk => {
            data += data_chunk
        })
        proc.once("error", () => res("FAILED"))
        proc.once("exit", () => res(data))
    })
}

export const TEMP_DATA_FOLDER = "./tmp"
export const SONGINFO_FILE = TEMP_DATA_FOLDER + "/infos.json"
const YTDLP = "yt-dlp"
const FFMPEG = "ffmpeg"

/// Gets the video title and uploader.
export async function get_video_meta(id: string): Promise<{ length: number, uploader: string, title: string } | null> {
    const splitstr = " ;22qi3mmwa7hfmn994433ki; "
    const ret = await async_join_text(exec(`${YTDLP} --print "%(duration)s${splitstr}%(uploader)s${splitstr}%(title)s" https://youtu.be/${id}`))
    console.log(">>>", ret);

    if (ret.includes(splitstr)) {
        const [duration, uploader, title] = ret.split(splitstr).map(v => v.trim())
        return { length: parseFloat(duration), uploader, title }
    } else {
        return null
    }
}

async function better_access(path: string): Promise<boolean> {
    try {
        await access(path, constants.R_OK | constants.R_OK)
        return true
    } catch {
        return false
    }
}

/// Downloads the video and returns true if it succeeded.
export async function download_video(id: string, file_name: string = id): Promise<"webm" | "mp4" | null> {
    await async_join(exec(`${YTDLP} https://youtu.be/${id} -o ${TEMP_DATA_FOLDER}/${file_name} --merge-output-format mp4 --remux-video mp4`))
    if (await better_access(`${TEMP_DATA_FOLDER}/${file_name}.webm`)) {
        return "webm"
    }
    if (await better_access(`${TEMP_DATA_FOLDER}/${file_name}.mp4`)) {
        return "mp4"
    }

    return null
}

/// Removes the video from the downloaded content, leaving just audio. Returns true if it succeded.
export async function make_audio_only(file_name: string): Promise<boolean> {
    const TEMP_NAME_EXT = "tmpconvertaudio"
    return (
        await async_join(exec(`${FFMPEG} -i ${file_name}.webm -vn ${TEMP_DATA_FOLDER}/${file_name}.${TEMP_NAME_EXT}.webm -n`)) &&
        await async_join(exec(`mv ${TEMP_DATA_FOLDER}/${file_name}.${TEMP_NAME_EXT}.webm ${TEMP_DATA_FOLDER}/${file_name}.webm`))
    )
}

class SongInfoStash {
    readonly data: Map<string, SongInfo & { format?: "webm" | "mp4" }>
    constructor() {
        try {
            this.data = new Map(Object.entries(JSON.parse(readFileSync(SONGINFO_FILE, { encoding: "utf8" }))))
        } catch {
            this.data = new Map()
        }
    }
    private next_write: null | boolean = null
    async save() {
        if (this.next_write === null) {
            this.next_write = false
            await writeFile(SONGINFO_FILE, JSON.stringify(Object.fromEntries(this.data.entries())), { encoding: "utf8" })
            if (this.next_write) {
                this.next_write = null
                this.save()
            } else {
                this.next_write = null
            }
        } else {
            this.next_write = true
        }
    }
}
export const SONGINFO_STASH = new SongInfoStash()