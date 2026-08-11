import type { TransactionType } from '#/lib/domain'

export type Category = {
  id: string
  name: string
  type: TransactionType
}
