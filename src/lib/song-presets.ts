export type SongCategory = "hot" | "animals" | "habits" | "bedtime";

export type SongPreset = {
  id: string;
  title: string;
  category: SongCategory;
  tag: string;
  icon: string;
  lyrics: string;
  sampleAudio?: string;
};

export const SONG_CATEGORIES: { id: SongCategory; label: string; icon: string }[] = [
  { id: "hot", label: "热门经典", icon: "🌟" },
  { id: "animals", label: "认识动物", icon: "🐾" },
  { id: "habits", label: "日常好习惯", icon: "👶" },
  { id: "bedtime", label: "睡前安抚", icon: "🌙" },
];

export const SONG_PRESETS: SongPreset[] = [
  // 热门经典
  {
    id: "head-shoulders",
    title: "Head, Shoulders, Knees and Toes",
    category: "hot",
    tag: "身体认知 · 动感律动",
    icon: "🙆‍♂️",
    sampleAudio: "/samples/audio/2-头肩膀膝盖脚趾-Head_Shoulders_Knees_and_Toes.wav",
    lyrics: `Head, shoulders, knees and toes, knees and toes.
Head, shoulders, knees and toes, knees and toes.
And eyes and ears and mouth and nose.
Head, shoulders, knees and toes, knees and toes.`,
  },
  {
    id: "if-you-are-happy",
    title: "If You're Happy and You Know It",
    category: "hot",
    tag: "情绪互动 · 经典拍手歌",
    icon: "👏",
    sampleAudio: "/samples/audio/5-幸福拍手歌-If_Youre_Happy_and_You_Know_It.flac",
    lyrics: `If you're happy and you know it, clap your hands.
If you're happy and you know it, clap your hands.
If you're happy and you know it, and you really want to show it.
If you're happy and you know it, clap your hands.`,
  },
  {
    id: "wheels-on-the-bus",
    title: "The Wheels on the Bus",
    category: "hot",
    tag: "交通出行 · 磨耳朵神曲",
    icon: "🚌",
    lyrics: `The wheels on the bus go round and round,
Round and round, round and round.
The wheels on the bus go round and round,
All through the town.
The wipers on the bus go swish, swish, swish,
All through the town.`,
  },
  {
    id: "bingo",
    title: "B-I-N-G-O (小狗宾果)",
    category: "hot",
    tag: "拼读启蒙 · 欢快活泼",
    icon: "🐶",
    sampleAudio: "/samples/audio/4-小狗宾果-Bingo.ogg",
    lyrics: `There was a farmer had a dog,
And Bingo was his name-o.
B-I-N-G-O, B-I-N-G-O,
B-I-N-G-O, and Bingo was his name-o!`,
  },

  // 认识动物
  {
    id: "two-tigers",
    title: "两只老虎 (Two Tigers)",
    category: "animals",
    tag: "经典双语 · 幼幼最爱",
    icon: "🐯",
    sampleAudio: "/samples/audio/6-两只老虎-Two_Tigers.aac",
    lyrics: `两只老虎，两只老虎，跑得快，跑得快。
一只没有耳朵，一只没有尾巴，真奇怪，真奇怪。
Two little tigers, two little tigers, running fast, running fast.
One has no ears, one has no tail, how strange, how strange!`,
  },
  {
    id: "old-macdonald",
    title: "Old MacDonald Had a Farm",
    category: "animals",
    tag: "农场动物 · 叫声启蒙",
    icon: "🐮",
    sampleAudio: "/samples/audio/3-王老先生有块地-Old_MacDonald_Had_a_Farm.m4a",
    lyrics: `Old MacDonald had a farm, E-I-E-I-O!
And on his farm he had a cow, E-I-E-I-O!
With a moo-moo here and a moo-moo there,
Here a moo, there a moo, everywhere a moo-moo!
Old MacDonald had a farm, E-I-E-I-O!`,
  },
  {
    id: "five-little-ducks",
    title: "Five Little Ducks (五只小鸭)",
    category: "animals",
    tag: "数字启蒙 · 亲情温暖",
    icon: "🦆",
    lyrics: `Five little ducks went out one day,
Over the hill and far away.
Mother duck said, "Quack, quack, quack, quack!"
But only four little ducks came back.`,
  },
  {
    id: "little-rabbit",
    title: "小兔子乖乖",
    category: "animals",
    tag: "安全自护 · 经典童谣",
    icon: "🐰",
    lyrics: `小兔子乖乖，把门儿开开，
快点儿开开，我要进来。
不开不开我不开，妈妈没回来，
谁来也不开！`,
  },

  // 日常好习惯
  {
    id: "brush-teeth",
    title: "Brush Your Teeth (刷牙歌)",
    category: "habits",
    tag: "健康生活 · 快乐刷牙",
    icon: "🪥",
    lyrics: `Brush, brush, brush your teeth,
Brush them every day!
Up and down and round and round,
Keep the cavities away!
Clean teeth, happy smile, all day long!`,
  },
  {
    id: "wash-hands",
    title: "Wash Your Hands (七步洗手法)",
    category: "habits",
    tag: "卫生习惯 · 防病护眼",
    icon: "🧼",
    lyrics: `Wash, wash, wash your hands,
Wash the germs away!
Soap and water, rub, rub, rub,
Keep them clean all day!
Front and back and in between, sparkling clean!`,
  },
  {
    id: "clean-up",
    title: "Clean Up Song (收玩具歌)",
    category: "habits",
    tag: "秩序养成 · 自理自律",
    icon: "🧸",
    lyrics: `Clean up, clean up,
Everybody everywhere!
Clean up, clean up,
Everybody do your share!
Put the toys away, ready for another day!`,
  },
  {
    id: "eat-veggies",
    title: "Yummy Vegetables (多吃青菜棒棒的)",
    category: "habits",
    tag: "不挑食 · 快乐干饭",
    icon: "🥦",
    lyrics: `Carrots, broccoli, peas and corn,
Healthy veggies every morn!
Crunch, crunch, yum, yum, good for me,
Strong and tall I will be!`,
  },

  // 睡前安抚
  {
    id: "twinkle-star",
    title: "Twinkle, Twinkle, Little Star",
    category: "bedtime",
    tag: "睡前陪伴 · 经典世界摇篮曲",
    icon: "⭐",
    sampleAudio: "/samples/audio/1-小星星-Twinkle_Twinkle_Little_Star.mp3",
    lyrics: `Twinkle, twinkle, little star,
How I wonder what you are!
Up above the world so high,
Like a diamond in the sky.
Twinkle, twinkle, little star,
How I wonder what you are!`,
  },
  {
    id: "rock-a-bye",
    title: "Rock-a-bye Baby",
    category: "bedtime",
    tag: "柔美旋律 · 温柔伴睡",
    icon: "🌙",
    lyrics: `Rock-a-bye baby, on the tree top,
When the wind blows, the cradle will rock.
When the bough breaks, the cradle will fall,
And down will come baby, cradle and all.`,
  },
  {
    id: "little-stars-zh",
    title: "小星星 (中文经典版)",
    category: "bedtime",
    tag: "静谧夜空 · 甜甜入梦",
    icon: "✨",
    lyrics: `一闪一闪亮晶晶，满天都是小星星。
挂在天空放光明，好像许多小眼睛。
一闪一闪亮晶晶，满天都是小星星。`,
  },
];
