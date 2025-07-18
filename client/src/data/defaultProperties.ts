import { Property } from "../types";

export const defaultProperties: Property[] = [
  {
    id: "1",
    name: "Apartments Kasunduan St. Diamond HOA ",
    address: "23 Kasunduan St. Brgy. Commonwealth QC",
    type: "residential",
    units: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Pleasant hills",
    address: "Please hills phase 6 SJDM",
    type: "residential",
    units: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];
