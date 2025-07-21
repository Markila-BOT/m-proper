import type { TransactionType } from "shared";

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
};
