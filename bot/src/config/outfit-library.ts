export interface Outfit {
  id: string;
  name: string;
  promptFragment: string;
  nsfw: boolean;
}

export const OUTFITS: Outfit[] = [
  {
    id: "sundress",
    name: "Sundress",
    promptFragment: "wearing a fitted red sundress with thin straps",
    nsfw: false,
  },
  {
    id: "jeans_crop_top",
    name: "Jeans and Crop Top",
    promptFragment: "wearing high-waisted jeans and a soft crop top",
    nsfw: false,
  },
  {
    id: "business_suit",
    name: "Business Suit",
    promptFragment: "wearing a tailored business suit with a sharp silhouette",
    nsfw: false,
  },
  {
    id: "yoga_set",
    name: "Yoga Pants and Sports Bra",
    promptFragment: "wearing yoga pants and a matching sports bra",
    nsfw: false,
  },
  {
    id: "bikini",
    name: "Bikini",
    promptFragment: "wearing a bright two-piece bikini",
    nsfw: false,
  },
  {
    id: "evening_gown",
    name: "Evening Gown",
    promptFragment: "wearing a floor-length evening gown with elegant drape",
    nsfw: false,
  },
  {
    id: "oversized_hoodie",
    name: "Oversized Hoodie",
    promptFragment: "wearing an oversized hoodie with a cozy casual vibe",
    nsfw: false,
  },
  {
    id: "school_uniform",
    name: "School Uniform",
    promptFragment: "wearing a classic school uniform with pleated skirt",
    nsfw: false,
  },
  {
    id: "nurse_outfit",
    name: "Nurse Outfit",
    promptFragment: "wearing a nurse outfit with clean white details",
    nsfw: false,
  },
  {
    id: "maid_outfit",
    name: "Maid Outfit",
    promptFragment: "wearing a black and white maid outfit with lace trim",
    nsfw: false,
  },
  {
    id: "cocktail_dress",
    name: "Cocktail Dress",
    promptFragment: "wearing a sleek cocktail dress with evening styling",
    nsfw: false,
  },
  {
    id: "leather_jacket_jeans",
    name: "Leather Jacket and Jeans",
    promptFragment: "wearing a leather jacket over jeans for an edgy look",
    nsfw: false,
  },
  {
    id: "summer_shorts",
    name: "Summer Shorts",
    promptFragment: "wearing summer shorts and a lightweight sleeveless top",
    nsfw: false,
  },
  {
    id: "sweater_skirt",
    name: "Sweater and Skirt",
    promptFragment: "wearing a soft knit sweater and a short skirt",
    nsfw: false,
  },
  {
    id: "pajama_set",
    name: "Pajama Set",
    promptFragment: "wearing a matching satin pajama set",
    nsfw: false,
  },

  {
    id: "lingerie",
    name: "Lingerie",
    promptFragment: "wearing a delicate lingerie set",
    nsfw: true,
  },
  {
    id: "lace_bra_panties",
    name: "Lace Bra and Panties",
    promptFragment: "wearing a lace bra and panties with sheer details",
    nsfw: true,
  },
  {
    id: "sheer_nightgown",
    name: "Sheer Nightgown",
    promptFragment: "wearing a sheer nightgown that softly reveals her silhouette",
    nsfw: true,
  },
  {
    id: "thong_only",
    name: "Thong Only",
    promptFragment: "wearing only a minimal thong",
    nsfw: true,
  },
  {
    id: "topless_with_jeans",
    name: "Topless with Jeans",
    promptFragment: "topless while wearing low-rise jeans",
    nsfw: true,
  },
  {
    id: "fully_nude",
    name: "Fully Nude",
    promptFragment: "fully nude with natural body confidence",
    nsfw: true,
  },
  {
    id: "bath_towel",
    name: "Bath Towel",
    promptFragment: "wearing only a loosely wrapped bath towel",
    nsfw: true,
  },
  {
    id: "see_through_dress",
    name: "See-Through Dress",
    promptFragment: "wearing a see-through dress with suggestive layering",
    nsfw: true,
  },
  {
    id: "garter_stockings",
    name: "Garter Belt and Stockings",
    promptFragment: "wearing a garter belt with thigh-high stockings",
    nsfw: true,
  },
  {
    id: "corset",
    name: "Corset",
    promptFragment: "wearing a tight corset accentuating her waist",
    nsfw: true,
  },
  {
    id: "open_shirt_no_bra",
    name: "Open Shirt No Bra",
    promptFragment: "wearing an unbuttoned shirt with no bra underneath",
    nsfw: true,
  },
  {
    id: "mesh_bodysuit",
    name: "Mesh Bodysuit",
    promptFragment: "wearing a black mesh bodysuit with revealing panels",
    nsfw: true,
  },
];

export function getRandomOutfit(nsfw?: boolean): Outfit {
  if (typeof nsfw === "boolean") {
    const filtered = OUTFITS.filter((outfit) => outfit.nsfw === nsfw);
    const pool = filtered.length > 0 ? filtered : OUTFITS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
}

export function getOutfitById(id: string): Outfit | undefined {
  return OUTFITS.find((outfit) => outfit.id === id);
}

export function searchOutfits(query: string): Outfit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const parts = normalized.split(/\s+/).filter(Boolean);

  const scored = OUTFITS.map((outfit) => {
    const haystack = `${outfit.name} ${outfit.id}`.toLowerCase();
    let score = 0;

    if (haystack.includes(normalized)) {
      score += 4;
    }

    for (const part of parts) {
      if (haystack.includes(part)) {
        score += 1;
      }
    }

    return { outfit, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.outfit.name.localeCompare(b.outfit.name));

  return scored.map((item) => item.outfit);
}
