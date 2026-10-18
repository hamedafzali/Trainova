// Monotonic version for the synced document so writes use compare-and-set
// instead of comparing timestamps (which lose precision through JSON).
export const sql = `
alter table user_state add column if not exists version bigint not null default 1;
`;
