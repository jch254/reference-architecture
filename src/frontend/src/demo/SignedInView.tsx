import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { RuntimeConfig } from '../../../shared/api-types';
import { Button } from '../ui/Button';
import { Toast, Toasts } from '../ui/Toast';
import { useWide } from '../ui/use-wide';

import { DemoShell, StatusLine } from './DemoShell';
import { IdentityReadout } from './IdentityReadout';
import { KeyReadout } from './KeyReadout';
import { Records } from './Records';
import { RequestLog } from './RequestLog';
import { SESSION_INVALID, settingsFact } from './demo-copy';
import { UNDO_MS, useSignedIn } from './use-signed-in';

interface FrameProps {
  /** null when GET /api/config failed. */
  config: RuntimeConfig | null;
  /** Who is signed in, as the auth provider names them. */
  account: string;
  signOutLabel: string;
  onSignOut: () => void;
}

/**
 * The frame of every signed-in state: the family header, then one mono line
 * with this deployment on the left and the account on the right.
 */
function SignedInFrame({
  config,
  account,
  signOutLabel,
  onSignOut,
  children,
}: FrameProps & { children: ReactNode }) {
  return (
    <DemoShell>
      <div className="account">
        <StatusLine fact={settingsFact(config)} />
        <div className="account-user">
          <span>{account}</span>
          <Button variant="ghost" onClick={onSignOut}>
            {signOutLabel}
          </Button>
        </div>
      </div>
      {children}
    </DemoShell>
  );
}

/**
 * The signed-in page, shared by every auth provider. What you do is on the
 * left: the records and, under them, who the API says you are. What the
 * system did with it is on the right: the key of the selected record and the
 * request log.
 *
 * A shell passes in only what differs between providers: who is signed in,
 * how to sign out and what to do when the API answers 401.
 */
export function SignedInView({
  onUnauthorized,
  onSignOut,
  ...frame
}: FrameProps & { onUnauthorized: () => void }) {
  const wide = useWide();
  const data = useSignedIn(onUnauthorized);
  const { records, user, held, commitDelete, undoDelete } = data;

  // Until a record is chosen the newest one is selected, so the page opens
  // with a record and its key side by side. undefined is "not chosen yet".
  const [selection, setSelectedId] = useState<string | null | undefined>(undefined);
  const [focus, setFocus] = useState<string | null>(null);

  const selectedId =
    selection === undefined ? (records?.find((record) => !record.pending)?.id ?? null) : selection;
  const selected = records?.find((record) => record.id === selectedId && !record.pending) ?? null;

  const create = async (name: string) => {
    const id = await data.create(name);
    if (id) setSelectedId(id);
    return id;
  };

  const undo = useCallback(() => {
    const record = undoDelete();
    if (!record) return;
    setSelectedId(record.id);
    setFocus(record.id);
  }, [undoDelete]);

  // Ctrl or Cmd with Z undoes a held delete, so the keyboard does not have
  // to reach the toast in five seconds. Typing in a field keeps its own undo.
  useEffect(() => {
    if (!held) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      undo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [held, undo]);

  const signOut = () => {
    // The held DELETE goes first, while the session can still authorise it.
    commitDelete({ keepalive: true });
    onSignOut();
  };

  return (
    <SignedInFrame {...frame} onSignOut={signOut}>
      <div className="signed-in">
        {data.loadError ? (
          <div className="notice" role="alert">
            {data.loadError}
            <Button variant="ghost" onClick={() => void data.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <Records
            records={records}
            selectedId={selectedId}
            wide={wide}
            error={data.error}
            focus={focus}
            onFocus={setFocus}
            onSelect={setSelectedId}
            onCreate={create}
            onRename={data.rename}
            onDelete={data.remove}
            renderKey={(record) => user && <KeyReadout user={user} record={record} inline />}
          />
        )}

        <div className="signed-in-side">
          {wide && user && <KeyReadout user={user} record={selected} />}
          <RequestLog clearable />
        </div>

        <IdentityReadout principal={data.principal} user={user} />
      </div>

      <Toasts>
        {held && (
          <Toast key={held.id} actionLabel="Undo" onAction={undo} onClose={commitDelete} duration={UNDO_MS}>
            Deleted &ldquo;{held.name}&rdquo;
          </Toast>
        )}
      </Toasts>
    </SignedInFrame>
  );
}

/**
 * Signed in with the provider, refused by the API. The account bar stays so
 * the way out is on the page, and the log stays so the 401 can be read.
 */
export function SessionInvalidPage(frame: FrameProps) {
  return (
    <SignedInFrame {...frame}>
      <div className="signed-in">
        <div className="notice" role="alert">
          {SESSION_INVALID}
          <Button variant="ghost" onClick={frame.onSignOut}>
            {frame.signOutLabel}
          </Button>
        </div>
        <div className="signed-in-side">
          <RequestLog clearable />
        </div>
      </div>
    </SignedInFrame>
  );
}
