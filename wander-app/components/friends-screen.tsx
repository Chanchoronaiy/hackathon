"use client";

import { ChevronRight, Plus, Trophy } from "lucide-react";
import { useState } from "react";
import { useFriends } from "@/hooks/use-friends";
import { respondToFriend, sendFriendRequest } from "@/lib/friends";

type FriendsScreenProps = {
  friendsFogPercent: number;
  onOpenFriendsFog: () => void;
  onAddFriend?: () => void;
};

export default function FriendsScreen({
  friendsFogPercent,
  onOpenFriendsFog,
  onAddFriend,
}: FriendsScreenProps) {
  const { snapshot, entries: leaderboard } = useFriends();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [username, setUsername] = useState("");
  async function respond(id: string, accept: boolean) {
    if (busy) return;
    setBusy(id); setNotice(null);
    try {
      await respondToFriend(id, accept);
      setNotice(accept ? "Friend accepted. Their walks and points are now on your friends leaderboard." : "Request declined.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Could not update request. Try again.");
    } finally { setBusy(null); }
  }

  return (
    <section className="friends-screen" aria-labelledby="friends-screen-title">
      <header className="friends-screen-header">
        <h1 id="friends-screen-title">Friends</h1>
        <p>Explore together, your own way.</p>
      </header>

      <button type="button" className="friends-add" onClick={() => { setAdding((current) => !current); onAddFriend?.(); }}>
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        <span>Add a friend</span>
      </button>

      {adding && (
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !username.trim()) return;
          setBusy("send"); setNotice(null);
          try {
            await sendFriendRequest(username);
            setNotice("Friend request sent."); setUsername(""); setAdding(false);
          } catch (reason) {
            setNotice(reason instanceof Error ? reason.message : "Could not send request.");
          } finally { setBusy(null); }
        }}>
          <label>Friend’s exact username <input value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <button type="submit" disabled={Boolean(busy) || !username.trim()}>Send request</button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}

      <button
        type="button"
        className="friends-fog-card"
        aria-label={`Friends fog, ${friendsFogPercent} percent uncovered. Open fog map.`}
        onClick={onOpenFriendsFog}
      >
        <span className="friends-fog-thumb" aria-hidden="true" />
        <span className="friends-fog-copy">
          <strong>Friends’ fog</strong>
          <span>Together, you’ve uncovered {friendsFogPercent}% of Adelaide.</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <div className="friends-section-title leaderboard-title">
        <span>Friends leaderboard</span>
        <Trophy size={17} aria-hidden="true" />
      </div>
      <ol className="leaderboard-list">
        {leaderboard.map((person, index) => (
          <li key={person.id} className={person.id === "you" ? "is-you" : ""}>
            <span className="leaderboard-rank">{index + 1}</span>
            <span className="friends-avatar is-mint" aria-hidden="true">{person.initials}</span>
            <strong>{person.name}</strong>
            <span>{person.points.toLocaleString()} pts · {person.completedWalks} walks</span>
          </li>
        ))}
      </ol>

      {snapshot?.pending.length ? (
        <>
          <h2 className="friends-section-title">Pending requests</h2>
          {snapshot.pending.map((pending) => <div className="friends-pending" key={pending.id}>
            <span className="friends-avatar is-amber" aria-hidden="true">{pending.name.slice(0, 2).toUpperCase()}</span>
            <span className="friends-row-copy">
              <strong>{pending.name}</strong>
              <span>Wants to be your friend</span>
            </span>
            <button
              type="button"
              className="friends-accept"
              disabled={Boolean(busy)}
              onClick={() => void respond(pending.id, true)}
            >
              Accept
            </button>
            <button
              type="button"
              className="friends-decline"
              disabled={Boolean(busy)}
              onClick={() => void respond(pending.id, false)}
            >
              Decline
            </button>
          </div>)}
        </>
      ) : null}
    </section>
  );
}
