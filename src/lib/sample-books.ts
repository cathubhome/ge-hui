import type { ScenePlan } from "@/lib/types";

export type SampleBook = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  icon: string;
  imageUrl: string;
  lyrics: string;
  plan: ScenePlan;
  sampleAudio?: string;
};

export const SAMPLE_BOOKS: SampleBook[] = [
  // 1. 头肩膀膝盖脚趾
  {
    id: "sample-head-shoulders",
    title: "Head, Shoulders, Knees and Toes",
    subtitle: "头肩膀膝盖脚趾 · 律动指读",
    tag: "身体认知 · 亲子指读",
    icon: "🙆‍♂️",
    imageUrl: "/samples/sample-head-shoulders.png",
    sampleAudio: "/samples/audio/2-头肩膀膝盖脚趾-Head_Shoulders_Knees_and_Toes.mp3",
    lyrics: `Head, shoulders, knees and toes, knees and toes.
Head, shoulders, knees and toes, knees and toes.
And eyes and ears and mouth and nose.
Head, shoulders, knees and toes, knees and toes.`,
    plan: {
      titleEn: "Head, Shoulders, Knees and Toes",
      titleZh: "头肩膀膝盖脚趾",
      layout: "spread",
      instructionZh: "",
      characterDescription: "头戴小熊帽子的可爱卡通小男孩乐乐，生动示范摸摸头、碰碰肩、点点膝盖和小脚丫，中英文双语对照，画面清爽生动。",
      lyricExcerpt: "Head, shoulders, knees and toes, knees and toes.",
      cast: ["小熊帽乐乐"],
      panels: [
        { labelEn: "Head & Shoulders", labelZh: "摸摸头和肩", action: "两手轻摸头顶与肩膀" },
        { labelEn: "Knees & Toes", labelZh: "碰碰膝盖和脚尖", action: "弯腰指着自己的小脚丫" },
      ],
    },
  },

  // 2. 两只老虎
  {
    id: "sample-two-tigers",
    title: "两只老虎 (Two Tigers)",
    subtitle: "幼幼必唱双语经典",
    tag: "动物认知 · 活泼躲猫猫",
    icon: "🐯",
    imageUrl: "/samples/sample-two-tigers.png",
    sampleAudio: "/samples/audio/6-两只老虎-Two_Tigers.mp3",
    lyrics: `两只老虎，两只老虎，跑得快，跑得快。
一只没有耳朵，一只没有尾巴，真奇怪，真奇怪。
Two little tigers, two little tigers, running fast, running fast.
One has no ears, one has no tail, how strange, how strange!`,
    plan: {
      titleEn: "Two Tigers",
      titleZh: "两只老虎",
      layout: "spread",
      instructionZh: "",
      characterDescription: "两只毛茸茸圆滚滚的可爱小老虎在阳光明媚的花田草地上嬉戏。一只可爱地用小肉爪捂着耳朵躲猫猫（耳朵藏起来啦），另一只圆滚滚坐在地上扭头找自己藏在身后的小尾巴玩，充满童趣与爱心。",
      lyricExcerpt: "两只老虎，两只老虎，跑得快，跑得快。",
      cast: ["捂耳躲猫猫虎", "找尾巴圆滚滚虎"],
      panels: [
        { labelEn: "Running Fast", labelZh: "跑得飞快", action: "两只小老虎在花丛中开心飞奔" },
        { labelEn: "Ears Hidden", labelZh: "耳朵藏起来", action: "小肉爪捂着耳朵嘻嘻笑" },
      ],
    },
  },

  // 3. 拍手歌
  {
    id: "sample-if-you-happy",
    title: "If You're Happy and You Know It",
    subtitle: "如果感到幸福你就拍拍手",
    tag: "情绪互动 · 拍手律动",
    icon: "👏",
    imageUrl: "/samples/sample-if-you-happy.png",
    sampleAudio: "/samples/audio/5-幸福拍手歌-If_Youre_Happy_and_You_Know_It.mp3",
    lyrics: `If you're happy and you know it, clap your hands.
If you're happy and you know it, clap your hands.
If you're happy and you know it, and you really want to show it.
If you're happy and you know it, clap your hands.`,
    plan: {
      titleEn: "If You're Happy and You Know It",
      titleZh: "如果感到幸福你就拍拍手",
      layout: "spread",
      instructionZh: "",
      characterDescription: "阳光开朗的小男孩身穿背带裤，身边有活泼憨厚的小棕熊与戴蝴蝶结的开心小白兔，在湖畔草地上快乐野餐跳舞拍手，音符与花瓣在空中飞扬。",
      lyricExcerpt: "If you're happy and you know it, clap your hands.",
      cast: ["开朗小男孩", "小棕熊", "小白兔"],
      panels: [
        { labelEn: "Clap Hands", labelZh: "拍拍双手", action: "开心地高举双手拍掌" },
        { labelEn: "Stamp Feet", labelZh: "跺跺双脚", action: "跟着节拍在草地上踩脚印" },
      ],
    },
  },

  // 4. 小星星
  {
    id: "sample-twinkle-star",
    title: "Twinkle, Twinkle, Little Star",
    subtitle: "小星星世界摇篮曲",
    tag: "睡前安抚 · 必学经典",
    icon: "⭐",
    imageUrl: "/samples/sample-twinkle-star.png",
    sampleAudio: "/samples/audio/1-小星星-Twinkle_Twinkle_Little_Star.mp3",
    lyrics: `Twinkle, twinkle, little star,
How I wonder what you are!
Up above the world so high,
Like a diamond in the sky.
Twinkle, twinkle, little star,
How I wonder what you are!`,
    plan: {
      titleEn: "Twinkle, Twinkle, Little Star",
      titleZh: "一闪一闪小星星",
      layout: "spread",
      instructionZh: "",
      characterDescription: "深蓝色静谧温暖的童话夜空，戴睡帽的月亮船上坐着甜甜微笑的小兔子，金黄色的小星星们在云朵间眨着眼睛闪闪发光，梦幻唯美。",
      lyricExcerpt: "Twinkle, twinkle, little star, how I wonder what you are!",
      cast: ["睡梦小兔", "月亮船", "闪亮小星"],
      panels: [
        { labelEn: "Little Star", labelZh: "眨眼小星", action: "小星星在天鹅绒般的夜空中闪烁" },
        { labelEn: "Diamond Sky", labelZh: "璀璨天幕", action: "像钻石般洒在云朵摇篮上" },
      ],
    },
  },

  // 5. 巴士轮子
  {
    id: "sample-wheels-bus",
    title: "The Wheels on the Bus",
    subtitle: "巴士上的轮子转呀转",
    tag: "出行认知 · 磨耳神曲",
    icon: "🚌",
    imageUrl: "/samples/sample-wheels-bus.png",
    sampleAudio: "/samples/audio/wheels-on-the-bus.mp3",
    lyrics: `The wheels on the bus go round and round,
Round and round, round and round.
The wheels on the bus go round and round,
All through the town.
The wipers on the bus go swish, swish, swish,
All through the town.`,
    plan: {
      titleEn: "The Wheels on the Bus",
      titleZh: "巴士轮子转呀转",
      layout: "spread",
      instructionZh: "",
      characterDescription: "一辆明黄色复古卡通双层大巴士沿着绿意盎然的田间公路欢快前行。向日葵般的金色大车轮飞快旋转，车窗里小狗、小兔和小熊快乐地向窗外挥手，彩云与雏菊一路相伴。",
      lyricExcerpt: "The wheels on the bus go round and round!",
      cast: ["黄色大巴士", "小动物乘客们"],
      panels: [
        { labelEn: "Round and Round", labelZh: "轮子转呀转", action: "大车轮欢快转动卷起落花" },
        { labelEn: "Through the Town", labelZh: "开过小镇", action: "穿过青山与向日葵花田" },
      ],
    },
  },

  // 6. 农场老麦
  {
    id: "sample-old-macdonald",
    title: "Old MacDonald Had a Farm",
    subtitle: "王老先生有块地",
    tag: "农场动物 · 叫声启蒙",
    icon: "🐮",
    imageUrl: "/samples/sample-old-macdonald.png",
    sampleAudio: "/samples/audio/3-王老先生有块地-Old_MacDonald_Had_a_Farm.mp3",
    lyrics: `Old MacDonald had a farm, E-I-E-I-O!
And on his farm he had a cow, E-I-E-I-O!
With a moo-moo here and a moo-moo there,
Here a moo, there a moo, everywhere a moo-moo!
Old MacDonald had a farm, E-I-E-I-O!`,
    plan: {
      titleEn: "Old MacDonald Had a Farm",
      titleZh: "王老先生有块地",
      layout: "spread",
      instructionZh: "",
      characterDescription: "和蔼可亲的白胡子老农夫开着红色小拖拉机，身后有花斑奶牛、摇摆小黄鸭和欢快的小花猪，红顶大谷仓与金黄麦田阳光灿烂。",
      lyricExcerpt: "Old MacDonald had a farm, E-I-E-I-O!",
      cast: ["老农夫", "花斑奶牛", "快乐小鸡"],
      panels: [
        { labelEn: "Moo-Moo Cow", labelZh: "花斑小牛", action: "小牛正在大口嚼青草发出一声牛鸣" },
        { labelEn: "Farm Tractor", labelZh: "红色拖拉机", action: "拖拉机欢快突突突开过草地" },
      ],
    },
  },

  // 7. 刷牙歌
  {
    id: "sample-brush-teeth",
    title: "Brush Your Teeth",
    subtitle: "刷牙歌 · 刷出亮晶晶小白牙",
    tag: "好习惯 · 健康护齿",
    icon: "🪥",
    imageUrl: "/samples/sample-brush-teeth.png",
    lyrics: `Brush, brush, brush your teeth,
Brush them every day!
Up and down and round and round,
Keep the cavities away!
Clean teeth, happy smile, all day long!`,
    plan: {
      titleEn: "Brush Your Teeth",
      titleZh: "快乐刷牙歌",
      layout: "spread",
      instructionZh: "",
      characterDescription: "可爱的小男孩与胖乎乎的毛绒小熊在色彩明亮的木质盥洗台前一起刷牙。他们拿着彩虹大牙刷，嘴边吹出像云朵般洁白轻盈的小泡泡，镜子里倒映出洁白整齐的小白牙与闪耀小星星。",
      lyricExcerpt: "Brush, brush, brush your teeth, brush them every day!",
      cast: ["刷牙小能手", "小熊玩伴"],
      panels: [
        { labelEn: "Brush Up and Down", labelZh: "上上下下刷", action: "手拿小牙刷仔细刷门牙" },
        { labelEn: "Sparkling Smile", labelZh: "露出洁白牙齿", action: "对着镜子咧开嘴开心笑" },
      ],
    },
  },

  // 8. 洗手歌
  {
    id: "sample-wash-hands",
    title: "Wash Your Hands",
    subtitle: "七步洗手歌 · 细菌全跑掉",
    tag: "卫生习惯 · 快乐洗手",
    icon: "🧼",
    imageUrl: "/samples/sample-wash-hands.png",
    lyrics: `Wash, wash, wash your hands,
Wash the germs away!
Soap and water, rub, rub, rub,
Keep them clean all day!
Front and back and in between, sparkling clean!`,
    plan: {
      titleEn: "Wash Your Hands",
      titleZh: "快乐洗手歌",
      layout: "spread",
      instructionZh: "",
      characterDescription: "在阳光充足的儿童洗手池旁，小男孩与小动物伙伴用温和的草本香皂搓出五彩斑斓的晶莹大泡泡。水花轻溅，泡泡在阳光下反射七彩光芒，洗完的小手干干净净闪闪发光。",
      lyricExcerpt: "Wash, wash, wash your hands, wash the germs away!",
      cast: ["讲卫生宝宝", "泡泡小鸭"],
      panels: [
        { labelEn: "Rub with Soap", labelZh: "搓搓小手心", action: "双手搓出满满绵密泡泡" },
        { labelEn: "Sparkling Clean", labelZh: "小手干干净净", action: "擦干双手亮出十个小指头" },
      ],
    },
  },

  // 9. 小狗宾果
  {
    id: "sample-bingo",
    title: "B-I-N-G-O",
    subtitle: "小狗宾果 · 拼读律动",
    tag: "字母拼读 · 欢快活泼",
    icon: "🐶",
    imageUrl: "/samples/sample-bingo.png",
    sampleAudio: "/samples/audio/4-小狗宾果-Bingo.mp3",
    lyrics: `There was a farmer had a dog,
And Bingo was his name-o.
B-I-N-G-O, B-I-N-G-O,
B-I-N-G-O, and Bingo was his name-o!`,
    plan: {
      titleEn: "B-I-N-G-O",
      titleZh: "小狗宾果",
      layout: "spread",
      instructionZh: "",
      characterDescription: "一只长着黑眼圈、系着红色帅气领结的斑点小狗 BINGO 在后院阳光草地上欢快起舞。草坪上散落着写有 B-I-N-G-O 的彩色积木，小蝴蝶在它湿漉漉的黑鼻尖上盘旋。",
      lyricExcerpt: "B-I-N-G-O, and Bingo was his name-o!",
      cast: ["小狗宾果", "红领结小鸟"],
      panels: [
        { labelEn: "Bingo Dancing", labelZh: "小狗跳舞", action: "后腿站立两前爪欢快拍手" },
        { labelEn: "Sing B-I-N-G-O", labelZh: "唱响名字", action: "昂起头欢快叫唤" },
      ],
    },
  },

  // 10. 五只小鸭
  {
    id: "sample-five-ducks",
    title: "Five Little Ducks",
    subtitle: "五只小鸭过小溪",
    tag: "数字启蒙 · 亲情温润",
    icon: "🦆",
    imageUrl: "/samples/sample-five-ducks.png",
    sampleAudio: "/samples/audio/five-little-ducks.mp3",
    lyrics: `Five little ducks went out one day,
Over the hill and far away.
Mother duck said, "Quack, quack, quack, quack!"
And all of the five little ducks came back!`,
    plan: {
      titleEn: "Five Little Ducks",
      titleZh: "五只小鸭",
      layout: "spread",
      instructionZh: "",
      characterDescription: "鸭妈妈戴着别致的宽檐草帽走在清澈的小溪边，身后五只毛茸茸的金黄色小鸭子排成整整齐齐的一纵队摇摇摆摆过溪水。水面上漂浮着盛开的睡莲与芦苇花，水珠晶莹剔透。",
      lyricExcerpt: "Five little ducks went out one day!",
      cast: ["草帽鸭妈妈", "五只小鸭宝贝"],
      panels: [
        { labelEn: "Waddling Ducks", labelZh: "摇摇摆摆", action: "五只小鸭跟着鸭妈妈过小溪" },
        { labelEn: "All Came Back", labelZh: "全回来啦", action: "小鸭子们扑向鸭妈妈温暖怀抱" },
      ],
    },
  },

  // 11. 小兔子乖乖
  {
    id: "sample-little-rabbit",
    title: "小兔子乖乖",
    subtitle: "安全自护经典童谣",
    tag: "安全启蒙 · 亲情自护",
    icon: "🐰",
    imageUrl: "/samples/sample-little-rabbit.png",
    lyrics: `小兔子乖乖，把门儿开开，
快点儿开开，我要进来。
不开不开我不开，妈妈没回来，
谁来也不开！`,
    plan: {
      titleEn: "Little Rabbit",
      titleZh: "小兔子乖乖",
      layout: "spread",
      instructionZh: "",
      characterDescription: "松树林深处的一座梦幻蘑菇小木屋。三只系着小围巾的长耳小兔子，隔着雕花小圆窗好奇温柔地向外张望，门栓锁得牢牢的，屋里充满壁炉温暖的橙光与烘焙饼干的香气。",
      lyricExcerpt: "不开不开我不开，妈妈没回来，谁来也不开！",
      cast: ["乖乖兔大宝", "机灵兔二宝", "乖巧兔小妹"],
      panels: [
        { labelEn: "Keep Door Locked", labelZh: "紧锁房门", action: "小兔子们警惕地守护着门栓" },
        { labelEn: "Wait for Mom", labelZh: "等待兔妈妈", action: "隔着窗户盼望提着萝卜的兔妈妈" },
      ],
    },
  },

  // 12. 摇篮曲
  {
    id: "sample-rock-a-bye",
    title: "Rock-a-bye Baby",
    subtitle: "树冠上的花篮摇篮曲",
    tag: "睡前恬静 · 温暖安抚",
    icon: "🌙",
    imageUrl: "/samples/sample-rock-a-bye.png",
    sampleAudio: "/samples/audio/rock-a-bye-baby.mp3",
    lyrics: `Rock-a-bye baby, on the tree top,
When the wind blows, the cradle will rock.
Softly and gently, into your dreams,
Safe and warm, under starlight beams.`,
    plan: {
      titleEn: "Rock-a-bye Baby",
      titleZh: "树顶摇篮曲",
      layout: "spread",
      instructionZh: "",
      characterDescription: "巨大的古老粉色开花树冠之间，编织着由柔软青藤与粉白花朵构成的花篮小摇篮。微风拂动花瓣，点点发光的萤火虫环绕四周，在梦幻的紫丁香晚霞天幕下甜美入眠。",
      lyricExcerpt: "Rock-a-bye baby, on the tree top!",
      cast: ["睡梦宝宝", "微风仙子", "发光萤火虫"],
      panels: [
        { labelEn: "Gentle Rocking", labelZh: "轻柔摇荡", action: "微风拂动花篮轻柔摇晃" },
        { labelEn: "Sweet Dreams", labelZh: "甜美入梦", action: "在萤火虫与星光中闭眼安睡" },
      ],
    },
  },
];
