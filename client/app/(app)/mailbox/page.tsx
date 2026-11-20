'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { ActionIcon } from '@/components/icons/ActionIcon';
import { RefreshDuotone } from '@/components/icons/RefreshDuotone';
import { mailboxApi } from '@/lib/api';
import ReadStatusFilter, { type ReadStatus } from '@/components/ReadStatusFilter';
import { cn } from '@/lib/utils';

interface Addr { name: string; address: string }
interface Folder { key: string; label: string; unseen: number }
interface MsgSummary {
    uid: number; subject: string; from: Addr | null; to: Addr[]; date: string;
    seen: boolean; flagged: boolean; hasAttachment: boolean;
}
interface MsgDetail {
    uid: number; subject: string; from: Addr | null; to: Addr[]; cc: Addr[]; date: string;
    messageId: string; references: string[]; flagged: boolean; html: string; text: string;
    attachments: { index: number; filename: string; contentType: string; size: number }[];
}
interface Draft { to: string; cc: string; subject: string; text: string; inReplyTo?: string; references?: string[] }

const PAGE_SIZE = 30;
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;
const who = (a: Addr | null) => (a ? a.name || a.address : '(không rõ)');
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
function fmtDate(s: string) {
    const d = new Date(s);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// Email HTML is untrusted: rendered in a sandboxed iframe with scripts and
// same-origin access disabled; links open in a new tab.
function emailDoc(m: MsgDetail) {
    const body = m.html || `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(m.text || '')}</pre>`;
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:12px;font:14px/1.5 -apple-system,system-ui,sans-serif;color:#0f172a;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style>
</head><body>${body}</body></html>`;
}

export default function MailboxPage() {
    const router = useRouter();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [account, setAccount] = useState('');
    const [folder, setFolder] = useState('inbox');
    const [query, setQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');
    const [readStatus, setReadStatus] = useState<ReadStatus>('all');
    const [messages, setMessages] = useState<MsgSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [open, setOpen] = useState<MsgDetail | null>(null);
    const [opening, setOpening] = useState<number | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [sending, setSending] = useState(false);
    const reqId = useRef(0);

    const loadFolders = useCallback(async () => {
        try {
            const r = await mailboxApi.folders();
            setFolders(r.data.data.folders);
            setAccount(r.data.data.account);
        } catch (e: any) {
            if (e?.response?.status === 403) { toast.error(errMsg(e, 'Không có quyền')); router.replace('/settings'); }
        }
    }, [router]);

    const load = useCallback(async (p = 1) => {
        const id = ++reqId.current;
        p === 1 ? setLoading(true) : setLoadingMore(true);
        setError('');
        try {
            const r = await mailboxApi.list({ folder, page: p, limit: PAGE_SIZE, q: activeQuery || undefined, status: readStatus });
            if (id !== reqId.current) return;
            const d = r.data.data;
            setTotal(d.total);
            setPage(p);
            setMessages(prev => (p === 1 ? d.messages : [...prev, ...d.messages]));
        } catch (e: any) {
            if (id === reqId.current) setError(errMsg(e, 'Không tải được hộp thư'));
        } finally {
            if (id === reqId.current) { setLoading(false); setLoadingMore(false); }
        }
    }, [folder, activeQuery, readStatus]);

    useEffect(() => { loadFolders(); }, [loadFolders]);
    useEffect(() => { setSelected(new Set()); load(1); }, [load]);

    const refresh = () => { load(1); loadFolders(); };

    const openMessage = async (m: MsgSummary) => {
        setOpening(m.uid);
        try {
            const r = await mailboxApi.get(folder, m.uid);
            setOpen(r.data.data);
            if (!m.seen) {
                setMessages(list => list.map(x => (x.uid === m.uid ? { ...x, seen: true } : x)));
                setFolders(fs => fs.map(f => (f.key === folder && f.unseen > 0 ? { ...f, unseen: f.unseen - 1 } : f)));
            }
        } catch (e) { toast.error(errMsg(e, 'Không mở được thư')); }
        finally { setOpening(null); }
    };

    // ── Actions (work on a single uid or the current selection) ──────────────
    const setFlag = async (uids: number[], flags: { seen?: boolean; flagged?: boolean }) => {
        try {
            await mailboxApi.flags(folder, uids, flags);
            setMessages(list => list.map(x => (uids.includes(x.uid) ? { ...x, ...flags } : x)));
            if (open && uids.includes(open.uid) && flags.flagged !== undefined) setOpen({ ...open, flagged: flags.flagged });
            if (flags.seen !== undefined) loadFolders();
        } catch (e) { toast.error(errMsg(e, 'Thao tác thất bại')); }
    };

    const remove = async (uids: number[]) => {
        const permanentFolder = folder === 'trash' || folder === 'spam';
        if (permanentFolder && !confirm(`Xoá vĩnh viễn ${uids.length} thư? Không thể khôi phục.`)) return;
        try {
            const r = await mailboxApi.remove(folder, uids);
            setMessages(list => list.filter(x => !uids.includes(x.uid)));
            setTotal(t => Math.max(0, t - uids.length));
            setSelected(new Set());
            if (open && uids.includes(open.uid)) setOpen(null);
            toast.success(r.data.data?.permanent ? 'Đã xoá vĩnh viễn' : 'Đã chuyển vào thùng rác');
            loadFolders();
        } catch (e) { toast.error(errMsg(e, 'Xoá thất bại')); }
    };

    const move = async (uids: number[], target: string, label: string) => {
        try {
            await mailboxApi.move(folder, uids, target);
            setMessages(list => list.filter(x => !uids.includes(x.uid)));
            setTotal(t => Math.max(0, t - uids.length));
            setSelected(new Set());
            if (open && uids.includes(open.uid)) setOpen(null);
            toast.success(`Đã chuyển sang ${label}`);
            loadFolders();
        } catch (e) { toast.error(errMsg(e, 'Di chuyển thất bại')); }
    };

    const download = async (m: MsgDetail, a: MsgDetail['attachments'][number]) => {
        try {
            const r = await mailboxApi.attachment(folder, m.uid, a.index);
            const url = URL.createObjectURL(r.data);
            const link = document.createElement('a');
            link.href = url; link.download = a.filename; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (e) { toast.error(errMsg(e, 'Tải tệp thất bại')); }
    };

    // ── Compose / reply ──────────────────────────────────────────────────────
    const reply = (m: MsgDetail, all = false) => {
        const me = account.toLowerCase();
        const cc = all
            ? [...m.to, ...m.cc].map(a => a.address).filter(a => a && a.toLowerCase() !== me && a !== m.from?.address)
            : [];
        const quoted = (m.text || '').split('\n').map(l => `> ${l}`).join('\n');
        setDraft({
            to: m.from?.address || '',
            cc: cc.join(', '),
            subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`,
            text: `\n\nVào ${new Date(m.date).toLocaleString('vi-VN')}, ${who(m.from)} đã viết:\n${quoted}`,
            inReplyTo: m.messageId,
            references: [...m.references, m.messageId].filter(Boolean),
        });
    };
    const forward = (m: MsgDetail) => setDraft({
        to: '', cc: '',
        subject: /^fwd?:/i.test(m.subject) ? m.subject : `Fwd: ${m.subject}`,
        text: `\n\n---------- Thư chuyển tiếp ----------\nTừ: ${who(m.from)} <${m.from?.address || ''}>\nNgày: ${new Date(m.date).toLocaleString('vi-VN')}\nTiêu đề: ${m.subject}\n\n${m.text || ''}`,
    });

    const send = async () => {
        if (!draft) return;
        if (!draft.to.trim()) { toast.error('Nhập người nhận'); return; }
        setSending(true);
        try {
            await mailboxApi.send({ ...draft, cc: draft.cc || undefined });
            toast.success('Đã gửi thư');
            setDraft(null);
            if (folder === 'sent') load(1);
        } catch (e) { toast.error(errMsg(e, 'Gửi thất bại')); }
        finally { setSending(false); }
    };

    const toggleSelect = (uid: number) => setSelected(s => {
        const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); return n;
    });
    const selection = useMemo(() => Array.from(selected), [selected]);
    const selectionAllRead = selection.every(uid => messages.find(m => m.uid === uid)?.seen);
    const folderLabel = folders.find(f => f.key === folder)?.label || 'Hộp thư';

    // ── Message detail view ─────────────────────────────────────────────────
    if (open) {
        return (
            <div className="min-h-screen pb-28 bg-gray-50 dark:bg-surface-deep">
                <PageHeader title={folderLabel} subtitle={account} onBack={() => setOpen(null)}
                    rightActions={
                        <div className="flex gap-2">
                            <IconBtn label={open.flagged ? 'Bỏ sao' : 'Gắn sao'} onClick={() => setFlag([open.uid], { flagged: !open.flagged })}>
                                <span className={cn('text-lg leading-none', open.flagged ? 'text-amber-400' : 'text-slate-400')}>★</span>
                            </IconBtn>
                            <IconBtn label="Đánh dấu chưa đọc" onClick={() => { setFlag([open.uid], { seen: false }); setOpen(null); }}>
                                <ActionIcon type="mail" size={16} tile={false} color="currentColor" />
                            </IconBtn>
                            <IconBtn label="Xoá" onClick={() => remove([open.uid])}>
                                <ActionIcon type="trash" size={16} tile={false} color="#EF4444" />
                            </IconBtn>
                        </div>
                    } />
                <div className="px-5 space-y-3">
                    <div className="bg-card rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                        <h1 className="text-base font-bold text-foreground leading-snug">{open.subject}</h1>
                        <p className="text-sm font-semibold text-foreground mt-2">{who(open.from)}
                            <span className="font-normal text-muted-foreground"> &lt;{open.from?.address}&gt;</span></p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Tới: {open.to.map(a => a.address).join(', ') || '—'}{open.cc.length ? ` · Cc: ${open.cc.map(a => a.address).join(', ')}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(open.date).toLocaleString('vi-VN')}</p>
                    </div>

                    {open.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {open.attachments.map(a => (
                                <button key={a.index} onClick={() => download(open, a)}
                                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-card border border-slate-200 dark:border-slate-700 text-foreground max-w-full truncate">
                                    📎 {a.filename} · {fmtSize(a.size)}
                                </button>
                            ))}
                        </div>
                    )}

                    <iframe
                        title="Nội dung thư"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        srcDoc={emailDoc(open)}
                        className="w-full h-[60vh] rounded-2xl border border-slate-100 dark:border-slate-800 bg-white"
                    />

                    <div className="grid grid-cols-3 gap-2">
                        <ActionBtn onClick={() => reply(open)}>Trả lời</ActionBtn>
                        <ActionBtn onClick={() => reply(open, true)}>Trả lời tất cả</ActionBtn>
                        <ActionBtn onClick={() => forward(open)}>Chuyển tiếp</ActionBtn>
                    </div>
                    {folder !== 'spam' && folder !== 'trash' && (
                        <button onClick={() => move([open.uid], 'spam', 'Thư rác')} className="w-full text-xs font-semibold text-muted-foreground py-2">
                            Báo cáo thư rác
                        </button>
                    )}
                    {(folder === 'spam' || folder === 'trash') && (
                        <button onClick={() => move([open.uid], 'inbox', 'Hộp thư đến')} className="w-full text-xs font-semibold text-brand py-2">
                            Chuyển về Hộp thư đến
                        </button>
                    )}
                </div>
                {draft && <Compose draft={draft} setDraft={setDraft} onSend={send} sending={sending} account={account} />}
            </div>
        );
    }

    // ── List view ───────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen pb-28 bg-gray-50 dark:bg-surface-deep">
            <PageHeader title="Hộp thư" subtitle={account || 'Đang kết nối…'} onBack={() => router.back()}
                rightActions={
                    <div className="flex gap-2">
                        <IconBtn label="Làm mới" onClick={refresh}>
                            <RefreshDuotone className={cn('w-4 h-4', loading && 'animate-spin')} />
                        </IconBtn>
                        <IconBtn label="Soạn thư" onClick={() => setDraft({ to: '', cc: '', subject: '', text: '' })} primary>
                            <ActionIcon type="plus" size={16} tile={false} color="currentColor" />
                        </IconBtn>
                    </div>
                } />

            <div className="px-5 space-y-3">
                {/* Folders */}
                <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar">
                    {(folders.length ? folders : [{ key: 'inbox', label: 'Hộp thư đến', unseen: 0 }]).map(f => (
                        <button key={f.key} onClick={() => { setFolder(f.key); setOpen(null); }}
                            className={cn('flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all',
                                folder === f.key ? 'bg-brand text-white' : 'bg-card text-foreground border border-slate-200 dark:border-slate-700')}>
                            {f.label}{f.unseen > 0 && <span className={cn('ml-1.5', folder === f.key ? 'text-white/80' : 'text-brand')}>{f.unseen}</span>}
                        </button>
                    ))}
                </div>

                <button onClick={() => router.push('/mailbox/traveloka')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-slate-100 dark:border-slate-800 text-left active:scale-[0.99] transition-all">
                    <span className="text-xl">🎁</span>
                    <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-foreground">Voucher Traveloka</span>
                        <span className="block text-xs text-muted-foreground">Mệnh giá & mã từ thư chưa đọc — chạm để copy</span>
                    </span>
                    <span className="text-muted-foreground">›</span>
                </button>

                {/* Search */}
                <form onSubmit={e => { e.preventDefault(); setActiveQuery(query.trim()); }} className="flex gap-2">
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Tìm thư (vd: from:vpbank, sao kê, has:attachment)"
                        className="flex-1 min-w-0 h-11 px-4 rounded-xl bg-card border border-slate-200 dark:border-slate-700 text-sm text-foreground outline-none focus:border-brand" />
                    {activeQuery && (
                        <button type="button" onClick={() => { setQuery(''); setActiveQuery(''); }}
                            className="h-11 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-foreground">Xoá</button>
                    )}
                </form>
                <div className="flex items-center gap-3">
                    <ReadStatusFilter value={readStatus} onChange={setReadStatus} className="flex-1" />
                    {!loading && <span className="text-xs font-semibold text-muted-foreground flex-shrink-0">{total} thư</span>}
                </div>

                {/* Bulk actions */}
                {selection.length > 0 && (
                    <div className="sticky top-16 z-10 bg-brand text-white rounded-2xl px-4 py-2.5 flex items-center gap-3 text-xs font-bold shadow-lg">
                        <span>Đã chọn {selection.length}</span>
                        <div className="ml-auto flex gap-3">
                            <button onClick={() => setFlag(selection, { seen: !selectionAllRead })}>{selectionAllRead ? 'Chưa đọc' : 'Đã đọc'}</button>
                            <button onClick={() => setFlag(selection, { flagged: true })}>Gắn sao</button>
                            <button onClick={() => remove(selection)}>Xoá</button>
                            <button onClick={() => setSelected(new Set())}>Huỷ</button>
                        </div>
                    </div>
                )}

                {/* List */}
                {loading && <p className="text-sm text-muted-foreground text-center py-10">Đang tải thư…</p>}
                {!loading && error && (
                    <div className="text-center py-10 space-y-3">
                        <p className="text-sm text-red-500">{error}</p>
                        <button onClick={() => load(1)} className="text-xs font-bold text-brand">Thử lại</button>
                    </div>
                )}
                {!loading && !error && messages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-10">Không có thư nào</p>
                )}
                {!loading && !error && messages.length > 0 && (
                    <div className="bg-card rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                        {messages.map(m => {
                            const isSel = selected.has(m.uid);
                            const party = folder === 'sent' || folder === 'drafts'
                                ? `Tới: ${m.to.map(a => a.name || a.address).join(', ') || '—'}`
                                : who(m.from);
                            return (
                                <div key={m.uid} className={cn('flex items-start gap-3 px-3.5 py-3', isSel && 'bg-brand/5')}>
                                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(m.uid)}
                                        className="mt-1 w-4 h-4 flex-shrink-0 accent-[var(--brand,#6C63FF)]" aria-label="Chọn thư" />
                                    <button onClick={() => openMessage(m)} disabled={opening === m.uid} className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-2">
                                            {!m.seen && <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />}
                                            <p className={cn('text-sm truncate flex-1', m.seen ? 'font-medium text-foreground/80' : 'font-bold text-foreground')}>{party}</p>
                                            <span className="text-[11px] text-muted-foreground flex-shrink-0">{opening === m.uid ? '…' : fmtDate(m.date)}</span>
                                        </div>
                                        <p className={cn('text-xs truncate mt-0.5', m.seen ? 'text-muted-foreground' : 'text-foreground font-semibold')}>
                                            {m.hasAttachment && '📎 '}{m.subject}
                                        </p>
                                    </button>
                                    <button onClick={() => setFlag([m.uid], { flagged: !m.flagged })} aria-label={m.flagged ? 'Bỏ sao' : 'Gắn sao'}
                                        className={cn('text-lg leading-none flex-shrink-0', m.flagged ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600')}>★</button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {!loading && messages.length < total && (
                    <button onClick={() => load(page + 1)} disabled={loadingMore}
                        className="w-full h-11 rounded-xl text-sm font-bold bg-card border border-slate-200 dark:border-slate-700 text-foreground disabled:opacity-60">
                        {loadingMore ? 'Đang tải…' : `Tải thêm (${total - messages.length} thư)`}
                    </button>
                )}
            </div>
            {draft && <Compose draft={draft} setDraft={setDraft} onSend={send} sending={sending} account={account} />}
        </div>
    );
}

function IconBtn({ children, label, onClick, primary }: { children: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
    return (
        <button onClick={onClick} aria-label={label} title={label}
            className={cn('w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all',
                primary ? 'bg-brand text-white' : 'bg-card border border-slate-200 dark:border-slate-700 text-foreground')}>
            {children}
        </button>
    );
}

function ActionBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button onClick={onClick} className="h-11 rounded-xl text-xs font-bold bg-card border border-slate-200 dark:border-slate-700 text-foreground active:scale-95 transition-all">
            {children}
        </button>
    );
}

function Compose({ draft, setDraft, onSend, sending, account }: {
    draft: Draft; setDraft: (d: Draft | null) => void; onSend: () => void; sending: boolean; account: string;
}) {
    const field = 'w-full h-11 px-3 rounded-xl bg-white dark:bg-surface border border-slate-200 dark:border-slate-700 text-sm text-foreground outline-none focus:border-brand';
    const close = () => {
        if ((draft.text.trim() || draft.subject.trim()) && !confirm('Huỷ thư đang soạn?')) return;
        setDraft(null);
    };
    return (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={close}>
            <div onClick={e => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-surface rounded-t-3xl sm:rounded-3xl p-4 space-y-2.5 max-h-[92vh] overflow-y-auto"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground">{draft.inReplyTo ? 'Trả lời' : 'Thư mới'}</h2>
                    <span className="text-[11px] text-muted-foreground truncate ml-3">Từ: {account}</span>
                </div>
                <input className={field} placeholder="Tới (nhiều địa chỉ cách nhau bằng dấu phẩy)" value={draft.to}
                    onChange={e => setDraft({ ...draft, to: e.target.value })} inputMode="email" />
                <input className={field} placeholder="Cc" value={draft.cc} onChange={e => setDraft({ ...draft, cc: e.target.value })} inputMode="email" />
                <input className={field} placeholder="Tiêu đề" value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} />
                <textarea className={cn(field, 'h-56 py-2.5 resize-none')} placeholder="Nội dung" value={draft.text}
                    onChange={e => setDraft({ ...draft, text: e.target.value })} />
                <div className="flex gap-2 pt-1">
                    <button onClick={close} className="flex-1 h-11 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-foreground">Huỷ</button>
                    <button onClick={onSend} disabled={sending} className="flex-1 h-11 rounded-xl text-sm font-bold bg-brand text-white disabled:opacity-60">
                        {sending ? 'Đang gửi…' : 'Gửi'}
                    </button>
                </div>
            </div>
        </div>
    );
}
