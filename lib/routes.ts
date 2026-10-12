export const groupPath = (id: string, tab?: string) => (tab ? `/g/${id}?tab=${tab}` : `/g/${id}`);

export const expensePath = (groupId: string, expenseId: number | 'new') => `/g/${groupId}/expense/${expenseId}`;
export const summaryImagePath = (groupId: string) => `/g/${groupId}/summary.png`;
