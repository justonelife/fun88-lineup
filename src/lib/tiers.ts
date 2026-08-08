/* =============================================================================
   CARD TIERS  —  the FIFA Online "khung thẻ" (card frame) ladder
   -----------------------------------------------------------------------------
   Rating is the single most important number on a player card, so it is also the
   thing that changes the card's whole appearance (visual-hierarchy: encode the
   primary variable with the strongest channel available — here, the frame).

   Four steps, wide enough apart to be told apart at 48px:
     bronze   < 75   flat, no glow      — squad filler
     silver   75-82  cool grey rim      — solid starter
     gold     83-88  warm rim + sheen   — the players you build around
     platinum 89+    iridescent + glow  — one or two per squad, if any

   Frames stay dark so white name text keeps >= 7:1 contrast at every tier; the
   tier lives in the rim, the wash and the rating ink, never in the text colour
   of the name plate. Von Restorff: only the top two tiers animate.
============================================================================= */

export type Tier = 'platinum' | 'gold' | 'silver' | 'bronze'

export function tierOf(ovr: number): Tier {
  if (ovr >= 89) return 'platinum'
  if (ovr >= 83) return 'gold'
  if (ovr >= 75) return 'silver'
  return 'bronze'
}

export interface TierSkin {
  /** Frame fill — tier wash at the head, near-black at the foot. */
  frame: string
  /** 1px rim. */
  edge: string
  /** Metallic strip along the top edge. */
  sheen: string
  /** Ink for the rating number and the tier furniture. */
  ink: string
  /** Ambient glow around the card; 'none' for the lower tiers. */
  glow: string
  /** Whether the frame runs the shimmer sweep. */
  shimmer: boolean
  label: string
}

export const TIER_SKIN: Record<Tier, TierSkin> = {
  platinum: {
    frame:
      'linear-gradient(168deg, rgba(168,232,255,.34) 0%, rgba(96,160,200,.16) 30%, rgba(9,16,28,.94) 66%, rgba(3,6,12,.97) 100%)',
    edge: 'rgba(196,240,255,.92)',
    sheen: 'linear-gradient(90deg, transparent, rgba(224,250,255,.95) 45%, rgba(150,220,255,.6) 70%, transparent)',
    ink: '#e6f8ff',
    glow: '0 0 22px -6px rgba(150,224,255,.75), 0 10px 26px -14px #000',
    shimmer: true,
    label: 'Platinum',
  },
  gold: {
    frame:
      'linear-gradient(168deg, rgba(247,201,72,.32) 0%, rgba(180,140,36,.14) 30%, rgba(12,14,20,.94) 66%, rgba(4,6,10,.97) 100%)',
    edge: 'rgba(255,221,133,.9)',
    sheen: 'linear-gradient(90deg, transparent, rgba(255,238,187,.95) 45%, rgba(219,165,31,.6) 70%, transparent)',
    ink: 'var(--color-gold-200)',
    glow: '0 0 18px -7px rgba(247,201,72,.7), 0 10px 26px -14px #000',
    shimmer: true,
    label: 'Gold',
  },
  silver: {
    frame:
      'linear-gradient(168deg, rgba(186,201,220,.22) 0%, rgba(120,138,162,.09) 30%, rgba(11,16,24,.94) 66%, rgba(4,7,14,.97) 100%)',
    edge: 'rgba(186,201,220,.72)',
    sheen: 'linear-gradient(90deg, transparent, rgba(222,232,244,.7) 50%, transparent)',
    ink: '#dbe4f0',
    glow: '0 8px 22px -14px #000',
    shimmer: false,
    label: 'Silver',
  },
  bronze: {
    frame:
      'linear-gradient(168deg, rgba(203,138,86,.22) 0%, rgba(132,86,50,.09) 30%, rgba(11,14,20,.94) 66%, rgba(4,6,11,.97) 100%)',
    edge: 'rgba(203,138,86,.66)',
    sheen: 'linear-gradient(90deg, transparent, rgba(226,178,138,.6) 50%, transparent)',
    ink: '#f0d5bf',
    glow: '0 8px 22px -14px #000',
    shimmer: false,
    label: 'Bronze',
  },
}

export const skinOf = (ovr: number): TierSkin => TIER_SKIN[tierOf(ovr)]
