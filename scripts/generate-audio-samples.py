import asyncio
import os
import subprocess
import edge_tts
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUTPUT_DIR = r"D:\wangyq158\workspace\ge-hui\test-audio-samples"
PUBLIC_DIR = r"D:\wangyq158\workspace\ge-hui\public\samples\audio"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

SONGS = [
    {
        "title": "1-小星星-Twinkle_Twinkle_Little_Star",
        "format": "mp3",
        "voice": "en-US-AnaNeural",
        "text": (
            "Twinkle, twinkle, little star, how I wonder what you are. "
            "Up above the world so high, like a diamond in the sky. "
            "Twinkle, twinkle, little star, how I wonder what you are."
        )
    },
    {
        "title": "2-头肩膀膝盖脚趾-Head_Shoulders_Knees_and_Toes",
        "format": "wav",
        "voice": "en-US-JennyNeural",
        "text": (
            "Head, shoulders, knees and toes, knees and toes. "
            "Head, shoulders, knees and toes, knees and toes. "
            "And eyes and ears and mouth and nose. "
            "Head, shoulders, knees and toes, knees and toes."
        )
    },
    {
        "title": "3-王老先生有块地-Old_MacDonald_Had_a_Farm",
        "format": "m4a",
        "voice": "en-US-AnaNeural",
        "text": (
            "Old MacDonald had a farm, E-I-E-I-O! "
            "And on his farm he had a cow, E-I-E-I-O! "
            "With a moo-moo here, and a moo-moo there, "
            "here a moo, there a moo, everywhere a moo-moo. "
            "Old MacDonald had a farm, E-I-E-I-O!"
        )
    },
    {
        "title": "4-小狗宾果-Bingo",
        "format": "ogg",
        "voice": "en-US-JennyNeural",
        "text": (
            "There was a farmer had a dog, and Bingo was his name-o. "
            "B-I-N-G-O! B-I-N-G-O! B-I-N-G-O! "
            "And Bingo was his name-o!"
        )
    },
    {
        "title": "5-幸福拍手歌-If_Youre_Happy_and_You_Know_It",
        "format": "flac",
        "voice": "en-US-AnaNeural",
        "text": (
            "If you're happy and you know it, clap your hands! "
            "If you're happy and you know it, clap your hands! "
            "If you're happy and you know it, and you really want to show it, "
            "if you're happy and you know it, clap your hands!"
        )
    },
    {
        "title": "6-两只老虎-Two_Tigers",
        "format": "aac",
        "voice": "zh-CN-XiaoxiaoNeural",
        "text": (
            "两只老虎，两只老虎，跑得快，跑得快。 "
            "一只没有眼睛，一只没有尾巴，真奇怪，真奇怪！"
        )
    }
]

async def generate():
    for item in SONGS:
        base_mp3 = os.path.join(OUTPUT_DIR, f"temp_{item['title']}.mp3")
        target_ext = item["format"]
        target_name = f"{item['title']}.{target_ext}"
        target_path = os.path.join(OUTPUT_DIR, target_name)
        public_path = os.path.join(PUBLIC_DIR, target_name)

        print(f"Generating TTS for: {target_name} ({item['voice']})...")
        communicate = edge_tts.Communicate(item["text"], item["voice"], rate="+5%")
        await communicate.save(base_mp3)

        if target_ext == "mp3":
            os.replace(base_mp3, target_path)
        else:
            print(f"Converting to {target_ext.upper()} via ffmpeg...")
            cmd = [FFMPEG, "-y", "-i", base_mp3, target_path]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            if os.path.exists(base_mp3):
                os.remove(base_mp3)

        # Copy to public dir
        with open(target_path, "rb") as sf, open(public_path, "wb") as df:
            df.write(sf.read())

        print(f"DONE: {target_name} ({os.path.getsize(target_path)} bytes)")

asyncio.run(generate())