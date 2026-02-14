export type PoseCategory =
  | "casual"
  | "sexy"
  | "athletic"
  | "glamour"
  | "cute"
  | "artistic";

export interface Pose {
  id: string;
  name: string;
  description: string;
  promptFragment: string;
  category: PoseCategory;
}

export const POSES: Pose[] = [
  {
    id: "mirror_selfie",
    name: "Mirror Selfie",
    description: "Classic standing mirror shot",
    promptFragment: "taking a mirror selfie with one hand holding the phone and relaxed posture",
    category: "casual",
  },
  {
    id: "sitting_on_couch",
    name: "Sitting on Couch",
    description: "Relaxed seated living-room pose",
    promptFragment: "sitting on a couch with legs crossed, relaxed pose",
    category: "casual",
  },
  {
    id: "walking_in_city",
    name: "Walking in City",
    description: "Candid motion while walking",
    promptFragment: "walking through a city street mid-step with a candid smile",
    category: "casual",
  },
  {
    id: "cooking_selfie",
    name: "Cooking Selfie",
    description: "Kitchen lifestyle pose",
    promptFragment: "posing in a kitchen while cooking, natural candid body language",
    category: "casual",
  },
  {
    id: "reading_in_bed",
    name: "Reading in Bed",
    description: "Soft cozy reading pose",
    promptFragment: "reading in bed with a book resting on her lap, cozy posture",
    category: "casual",
  },
  {
    id: "lounging_on_sofa",
    name: "Lounging on Sofa",
    description: "Casual laid-back lounge",
    promptFragment: "lounging on a sofa with one arm behind her head, effortless pose",
    category: "casual",
  },
  {
    id: "coffee_shop_table",
    name: "Coffee Shop Table",
    description: "Seated cafe candid",
    promptFragment: "sitting at a coffee shop table with elbows lightly resting and casual expression",
    category: "casual",
  },
  {
    id: "car_passenger_selfie",
    name: "Car Passenger Selfie",
    description: "Front-seat handheld selfie",
    promptFragment: "taking a front-seat car selfie with natural daylight and relaxed shoulders",
    category: "casual",
  },

  {
    id: "lying_on_bed_seductive",
    name: "Lying on Bed Seductively",
    description: "Reclined seductive pose",
    promptFragment: "lying on a bed seductively with arched back and confident eye contact",
    category: "sexy",
  },
  {
    id: "leaning_against_wall",
    name: "Leaning Against Wall",
    description: "Standing wall tease",
    promptFragment: "leaning against a wall with one knee bent and teasing body language",
    category: "sexy",
  },
  {
    id: "hands_and_knees",
    name: "On Hands and Knees",
    description: "Kneeling pose",
    promptFragment: "on hands and knees with a playful over-shoulder look",
    category: "sexy",
  },
  {
    id: "bending_over",
    name: "Bending Over",
    description: "Curved over pose",
    promptFragment: "bending over slightly with a confident teasing expression",
    category: "sexy",
  },
  {
    id: "looking_over_shoulder",
    name: "Looking Over Shoulder",
    description: "Rear-angle eye contact",
    promptFragment: "turning away and looking over her shoulder with seductive eye contact",
    category: "sexy",
  },
  {
    id: "legs_up_pose",
    name: "Legs Up",
    description: "Reclined elevated-legs pose",
    promptFragment: "reclining with legs up against a wall, flirtatious relaxed pose",
    category: "sexy",
  },
  {
    id: "chair_straddle",
    name: "Chair Straddle",
    description: "Reverse chair pose",
    promptFragment: "straddling a chair backwards with chin resting on folded arms",
    category: "sexy",
  },
  {
    id: "sheet_wrap",
    name: "Sheet Wrap",
    description: "Bed-sheet tease pose",
    promptFragment: "wrapped in bedsheets with one shoulder exposed and a smoldering look",
    category: "sexy",
  },

  {
    id: "yoga_pose",
    name: "Yoga Pose",
    description: "Balanced yoga stance",
    promptFragment: "holding a graceful yoga pose with controlled breathing and poised posture",
    category: "athletic",
  },
  {
    id: "stretching_pose",
    name: "Stretching",
    description: "Pre-workout stretch",
    promptFragment: "stretching with arms overhead and core engaged, natural athletic form",
    category: "athletic",
  },
  {
    id: "running_stride",
    name: "Running",
    description: "Action running motion",
    promptFragment: "captured in a running stride with energetic forward momentum",
    category: "athletic",
  },
  {
    id: "gym_mirror_selfie",
    name: "Gym Mirror Selfie",
    description: "Post-workout mirror shot",
    promptFragment: "taking a gym mirror selfie after training with confident posture",
    category: "athletic",
  },
  {
    id: "boxing_stance",
    name: "Boxing Stance",
    description: "Guard-up fight stance",
    promptFragment: "in a boxing stance with gloves up and focused determined expression",
    category: "athletic",
  },
  {
    id: "tennis_serve_prep",
    name: "Tennis Serve Prep",
    description: "Ready-to-serve sports pose",
    promptFragment: "preparing for a tennis serve with athletic balance and open stance",
    category: "athletic",
  },

  {
    id: "red_carpet_pose",
    name: "Red Carpet Pose",
    description: "Elegant event stance",
    promptFragment: "posing like on a red carpet with shoulders back and elegant confidence",
    category: "glamour",
  },
  {
    id: "hand_on_hip",
    name: "Hand on Hip",
    description: "Classic glamour silhouette",
    promptFragment: "standing with one hand on hip and chin slightly lifted",
    category: "glamour",
  },
  {
    id: "blowing_a_kiss",
    name: "Blowing a Kiss",
    description: "Playful glamour gesture",
    promptFragment: "blowing a kiss toward the camera with soft glamorous eye makeup",
    category: "glamour",
  },
  {
    id: "holding_champagne",
    name: "Holding Champagne",
    description: "Upscale party pose",
    promptFragment: "holding a champagne glass with poised wrist and luxurious expression",
    category: "glamour",
  },
  {
    id: "sitting_on_stairs",
    name: "Sitting on Stairs",
    description: "Stylized seated glamour",
    promptFragment: "sitting on stairs with elegant posture and legs angled for a fashion-forward look",
    category: "glamour",
  },
  {
    id: "runway_turn",
    name: "Runway Turn",
    description: "Fashion turn pose",
    promptFragment: "mid runway-style turn with dramatic movement and camera-ready confidence",
    category: "glamour",
  },

  {
    id: "peace_sign",
    name: "Peace Sign",
    description: "Cheerful selfie gesture",
    promptFragment: "holding up a peace sign near her face with cheerful playful energy",
    category: "cute",
  },
  {
    id: "pouting_lips",
    name: "Pouting Lips",
    description: "Cute pout expression",
    promptFragment: "making a cute pout with bright eyes and soft playful expression",
    category: "cute",
  },
  {
    id: "hugging_pillow",
    name: "Hugging Pillow",
    description: "Cozy bedroom pose",
    promptFragment: "hugging a pillow against her chest with cozy affectionate body language",
    category: "cute",
  },
  {
    id: "stomach_kicking_feet",
    name: "Lying on Stomach Kicking Feet",
    description: "Playful bed pose",
    promptFragment: "lying on her stomach and kicking her feet up playfully",
    category: "cute",
  },
  {
    id: "covering_face_shy",
    name: "Covering Face Shyly",
    description: "Bashful gesture",
    promptFragment: "covering part of her face shyly while peeking through fingers",
    category: "cute",
  },
  {
    id: "heart_hands",
    name: "Heart Hands",
    description: "Hand-heart gesture",
    promptFragment: "making a heart shape with her hands in front of the camera",
    category: "cute",
  },

  {
    id: "silhouette_pose",
    name: "Silhouette",
    description: "Backlit outline composition",
    promptFragment: "posed as a dramatic silhouette against strong backlight",
    category: "artistic",
  },
  {
    id: "profile_shot",
    name: "Profile Shot",
    description: "Side-profile portrait",
    promptFragment: "captured in profile with clean side lighting and sculpted features",
    category: "artistic",
  },
  {
    id: "looking_out_window",
    name: "Looking Out Window",
    description: "Reflective moody pose",
    promptFragment: "looking out a window thoughtfully with soft directional light",
    category: "artistic",
  },
  {
    id: "reflection_in_mirror",
    name: "Reflection in Mirror",
    description: "Layered mirror composition",
    promptFragment: "captured through a mirror reflection with layered framing",
    category: "artistic",
  },
  {
    id: "underwater_pose",
    name: "Underwater",
    description: "Floaty underwater mood",
    promptFragment: "floating underwater with hair drifting naturally and ethereal posture",
    category: "artistic",
  },
  {
    id: "shadow_play",
    name: "Shadow Play",
    description: "Patterned light and shadow",
    promptFragment: "posing through patterned shadows across her face and body",
    category: "artistic",
  },
];

export function getRandomPose(category?: PoseCategory): Pose {
  const source = category ? POSES.filter((pose) => pose.category === category) : POSES;
  const pool = source.length > 0 ? source : POSES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getPoseById(id: string): Pose | undefined {
  return POSES.find((pose) => pose.id === id);
}

export function getPosesByCategory(category: PoseCategory): Pose[] {
  return POSES.filter((pose) => pose.category === category);
}
