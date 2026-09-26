export type Interest = "art" | "coffee" | "green";
export type PlaceCategory = Interest | "history" | "water" | "calm";

export type AdelaidePlace = {
  id: string;
  name: string;
  category: PlaceCategory;
  position: [number, number];
  reason: string;
  surprise: number;
  comfort: number;
  openingHours?: string;
};

export const START: AdelaidePlace = {
  id: "victoria-square",
  name: "Victoria Square / Tarntanyangga",
  category: "green",
  position: [-34.92852, 138.60075],
  reason: "Your start and finish",
  surprise: 0,
  comfort: 2,
};

// Curated from the cached Adelaide OpenStreetMap extract in research/adelaide.
// Keeping this list small makes the judging demo deterministic and inspectable.
export const ADELAIDE_PLACES: AdelaidePlace[] = [
  { id: "captain-sturt", name: "Captain Charles Sturt", category: "art", position: [-34.92734, 138.59944], reason: "A bronze figure hiding beside the square", surprise: 4, comfort: 1 },
  { id: "rundle-lantern", name: "Rundle Lantern", category: "art", position: [-34.92278, 138.60572], reason: "A glowing city-scale artwork", surprise: 4, comfort: 1 },
  { id: "arlos", name: "Arlo's", category: "coffee", position: [-34.92453, 138.59987], reason: "A small coffee pause on King William Street", surprise: 2, comfort: 2 },
  { id: "elementary", name: "Elementary Coffee", category: "coffee", position: [-34.92655, 138.59596], reason: "A tucked-away west-end coffee stop", surprise: 3, comfort: 2, openingHours: "Mo–Fr 07:30–15:00" },
  { id: "part-time-lover", name: "Part-Time Lover", category: "coffee", position: [-34.92633, 138.60062], reason: "A playful courtyard detour", surprise: 4, comfort: 2 },
  { id: "light-square", name: "Light Square / Wauwi", category: "green", position: [-34.92433, 138.59293], reason: "Trees, lawns and a breather from traffic", surprise: 2, comfort: 5 },
  { id: "helen-mayo", name: "Helen Mayo Park", category: "green", position: [-34.91972, 138.59053], reason: "A riverside green edge of the city", surprise: 3, comfort: 5 },
  { id: "lights-memorial", name: "Light's Memorial", category: "history", position: [-34.92507, 138.59363], reason: "A fragment of Adelaide's survey story", surprise: 4, comfort: 2 },
  { id: "boer-war", name: "Boer War Memorial", category: "history", position: [-34.92139, 138.59968], reason: "A landmark most commuters pass without stopping", surprise: 3, comfort: 2 },
  { id: "city-library", name: "City Library", category: "calm", position: [-34.92322, 138.60238], reason: "Indoor seating and a quieter reset", surprise: 2, comfort: 5, openingHours: "Hours available in OSM; verify before visiting" },
  { id: "water-victoria", name: "Victoria Square drinking fountain", category: "water", position: [-34.92766, 138.60007], reason: "A quick water refill", surprise: 1, comfort: 5 },
  { id: "water-hindmarsh", name: "Hindmarsh Square drinking fountain", category: "water", position: [-34.92368, 138.60503], reason: "A water stop near a leafy square", surprise: 1, comfort: 5 },
];

export const POI_DATA_TIMESTAMP = "31 May 2026";
