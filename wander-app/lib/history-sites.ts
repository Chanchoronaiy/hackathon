import type { LatLng } from "@/lib/route-planner";

export type HistorySite = {
  id: string;
  name: string;
  position: LatLng;
  facts: string[];
  sourceLabel: string;
  sourceUrl: string;
  beforeAfter?: HistoryImagePair;
};

export type HistoryImage = {
  url: string;
  label: string;
  credit: string;
  sourceUrl: string;
};

export type HistoryImagePair = {
  before: HistoryImage;
  after: HistoryImage;
};

export const HISTORY_SITES: HistorySite[] = [
  {
    id: "central-market-history",
    name: "Adelaide Central Market",
    position: [-34.928943, 138.597524],
    facts: [
      "Picture the pre-dawn rush: at 3:15 a.m. on 23 January 1869, market gardeners opened here. More than 500 people arrived, and every bit of stock was gone by 6 a.m.",
      "Look up at the Market facade: its first stone was laid on 8 February 1900, and it still stands here today.",
    ],
    sourceLabel: "Adelaide Central Market",
    sourceUrl: "https://adelaidecentralmarket.com.au/about/",
  },
  {
    id: "botanic-garden-history",
    name: "Adelaide Botanic Garden",
    position: [-34.918396, 138.61111],
    facts: [
      "On opening day, 4 October 1857, 634 visitors came through these gates. You are walking through a garden that began with a crowd.",
      "Imagine a giant waterlily under glass: Victoria House was built here in 1868, the same year Victoria amazonica flowered successfully for the first time.",
    ],
    sourceLabel: "Botanic Gardens and State Herbarium of South Australia",
    sourceUrl: "https://www.botanicgardens.sa.gov.au/about/about-bgsh/history/adelaide-botanic-gardens-history",
    beforeAfter: {
      before: {
        url: "/images/palm-house-elevation.jpg",
        label: "Palm House elevation, 1874",
        credit: "Unknown author · Public domain",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Aufriss_Adelaide_Palm_House.jpg",
      },
      after: {
        url: "/images/palm-house-exterior.jpg",
        label: "Palm House exterior, 2021",
        credit: "Ashton 29 · CC BY-SA 4.0",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Palm_House,_Adelaide_Botanic_Gardens.jpg",
      },
    },
  },
  {
    id: "migration-museum-history",
    name: "Migration Museum",
    position: [-34.919704, 138.602067],
    facts: [
      "Look around: these heritage-listed buildings date from 1860 and 1889, making them among the oldest surviving buildings in Adelaide's city centre.",
      "A milestone for this museum: when it turned 40 in 2026, the History Trust called it the first museum of its kind in the world.",
    ],
    sourceLabel: "History Trust of South Australia",
    sourceUrl: "https://www.history.sa.gov.au/migration-museum-renewal/",
    beforeAfter: {
      before: {
        url: "/images/destitute-asylum.jpg",
        label: "Destitute Asylum site, c.1868",
        credit: "State Library of South Australia · CC0",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Destitute_Asylum_1024.jpg",
      },
      after: {
        url: "/images/migration-museum.jpg",
        label: "Former asylum building, 2012",
        credit: "Bahudhara · CC BY-SA 3.0",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Migration_Museum,_Adelaide_-_former_Destitute_Asylum_building.JPG",
      },
    },
  },
];