"use client";

import { useMemo, useState } from "react";

type RecentUsageRow = {
  id: string;
  userId: string;
  publication: string;
  checkedOn: string;
  status: string;
  reason: string;
  runs: string;
  words: string;
  cost: string;
};

type UserActivityRow = {
  id: string;
  userId: string;
  role: string;
  activity: string;
  dateTime: string;
};

function visibleText(row: Record<string, string | number>) {
  return Object.values(row).join(" ").toLowerCase();
}

function LoadMoreButton({ visible, total, onClick }: { visible: number; total: number; onClick: () => void }) {
  if (visible >= total) return null;
  return <button className="table-load-more" type="button" onClick={onClick}>Load More</button>;
}

function EmailCell({ email }: { email: string }) {
  const parts = email.split(/([@.])/);
  return <>{parts.map((part, index) => <span key={`${part}-${index}`}>{part}{part === "@" || part === "." ? <wbr/> : null}</span>)}</>;
}

export function RecentUsageTable({ rows }: { rows: RecentUsageRow[] }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(5);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => visibleText(row).includes(needle));
  }, [query, rows]);
  const shown = filtered.slice(0, visible);

  return <>
    <input className="table-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(5); }} placeholder="Search by user, status or publication" aria-label="Search recent usage"/>
    <table className="table admin-data-table recent-usage-table"><thead><tr><th>User ID</th><th>Publication</th><th>Checked<br/>on</th><th>Status</th><th>Reason</th><th>URLs /<br/>Words</th><th>Est. Cost<br/>(₹)</th></tr></thead><tbody>{shown.length ? shown.map((item) => <tr key={item.id}><td className="email-cell" data-label="User ID"><EmailCell email={item.userId}/></td><td data-label="Publication">{item.publication}</td><td data-label="Checked on">{item.checkedOn}</td><td className="status-cell" data-label="Status"><span className={`pill ${item.status.toLowerCase()}`}>{item.status}</span></td><td className="reason-cell" data-label="Reason">{item.reason}</td><td className="runs-words" data-label="URLs / Words"><strong>{item.runs} URLs optimised</strong><small>{item.words} words optimised</small></td><td data-label="Est. Cost (₹)">{item.cost}</td></tr>) : <tr><td colSpan={7}>No results found.</td></tr>}</tbody></table>
    <LoadMoreButton visible={visible} total={filtered.length} onClick={() => setVisible((count) => count + 5)}/>
  </>;
}

export function UserActivityTable({ rows }: { rows: UserActivityRow[] }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(5);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => visibleText(row).includes(needle));
  }, [query, rows]);
  const shown = filtered.slice(0, visible);

  return <>
    <input className="table-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(5); }} placeholder="Search by user or activity" aria-label="Search user activity"/>
    <table className="table admin-data-table user-activity-table"><thead><tr><th>User ID</th><th>Role</th><th>Activity</th><th>Date/Time</th></tr></thead><tbody>{shown.length ? shown.map((item) => <tr key={item.id}><td className="email-cell" data-label="User ID"><EmailCell email={item.userId}/></td><td data-label="Role">{item.role}</td><td data-label="Activity">{item.activity}</td><td data-label="Date/Time">{item.dateTime}</td></tr>) : <tr><td colSpan={4}>No results found.</td></tr>}</tbody></table>
    <LoadMoreButton visible={visible} total={filtered.length} onClick={() => setVisible((count) => count + 5)}/>
  </>;
}
