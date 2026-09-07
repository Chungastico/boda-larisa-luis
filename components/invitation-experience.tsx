'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Send,
  Users,
  X,
} from 'lucide-react';
import gsap from 'gsap';
import { Button } from '@/components/ui/button';
import type { Invitation, RsvpStatus } from '@/lib/invitations';

const weddingDate = new Date('2026-10-04T16:00:00-06:00');

const galleryPhotos = [
  { src: '/figma/photos/hand.png', alt: 'Larissa y Luis, detalle de sus manos', frame: 'arch-top' },
  { src: '/figma/photos/camisa-celeste-vestido.png', alt: 'Larissa y Luis juntos', frame: 'diagonal-top' },
  { src: '/figma/photos/boda-all-black.png', alt: 'Larissa y Luis vestidos de negro', frame: 'diagonal-bottom' },
  { src: '/figma/photos/camisa-celeste-vestido-cuerpo-completo.png', alt: 'Larissa y Luis de cuerpo completo', frame: 'arch-bottom' },
  { src: '/figma/photos/labios-rojos.png', alt: 'Retrato de Larissa y Luis', frame: 'arch-top' },
  { src: '/figma/photos/puerta-del-diablo.png', alt: 'Larissa y Luis en la Puerta del Diablo', frame: 'diagonal-top' },
  { src: '/figma/photos/playa-negro.png', alt: 'Larissa y Luis en la playa', frame: 'diagonal-bottom' },
  { src: '/figma/photos/sentados-en-piedra.png', alt: 'Larissa y Luis sentados en piedra', frame: 'arch-bottom' },
  { src: '/figma/photos/lago-celeste.png', alt: 'Larissa y Luis junto al lago', frame: 'arch-top' },
  { src: '/figma/photos/playa-oscuro.png', alt: 'Larissa y Luis en la playa al atardecer', frame: 'diagonal-top' },
  { src: '/figma/photos/calles-de-piedra.png', alt: 'Larissa y Luis en calles de piedra', frame: 'diagonal-bottom' },
  { src: '/figma/photos/vestido-y-camisa-celeste.png', alt: 'Larissa y Luis mirandose', frame: 'arch-bottom' },
] as const;

type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

function Countdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const updateRemaining = () => {
      setRemaining(Math.max(0, weddingDate.getTime() - Date.now()));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  const parts = useMemo(() => {
    const totalSeconds = Math.floor(remaining / 1_000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return [
      { value: days, label: 'Dias' },
      { value: hours, label: 'Horas' },
      { value: minutes, label: 'Minutos' },
      { value: seconds, label: 'Segundos' },
    ];
  }, [remaining]);

  return (
    <div className="grid grid-cols-4 gap-px bg-[#c7b79c]" aria-label="Cuenta regresiva">
      {parts.map((part) => (
        <div key={part.label} className="bg-[#f4eee2] px-2 py-3 text-center text-[#313624]">
          <p className="font-display text-2xl leading-none tabular-nums">{String(part.value).padStart(2, '0')}</p>
          <p className="mt-1 text-[10px] uppercase">{part.label}</p>
        </div>
      ))}
    </div>
  );
}

function DetailRow({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-3 border-t border-[#d8d0bf] py-4 first:border-t-0 first:pt-0">
      <span className="mt-0.5 text-[#78805e]">{icon}</span>
      <div>
        <p className="font-display text-lg leading-none text-[#313624]">{title}</p>
        <div className="mt-1 text-sm leading-6 text-[#5c614d]">{children}</div>
      </div>
    </div>
  );
}

export function InvitationExperience({
  invitation,
}: {
  invitation: Invitation;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLImageElement>(null);
  const [decision, setDecision] = useState<RsvpStatus | null>(
    invitation.status === 'PENDING' ? null : invitation.status,
  );
  const [guestCount, setGuestCount] = useState(
    invitation.attendingCount || invitation.maxGuests,
  );
  const [note, setNote] = useState(invitation.note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedStatus, setSavedStatus] = useState<RsvpStatus | null>(null);
  const [error, setError] = useState('');

  const persistRsvp = useCallback(
    async (status: RsvpStatus, attendingCount: number, message: string) => {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: invitation.slug,
          status,
          attendingCount,
          note: message,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        invitation?: Invitation;
        error?: string;
      } | null;

      if (!response.ok || !payload?.invitation) {
        throw new Error(payload?.error ?? 'No se pudo guardar tu respuesta.');
      }

      setSavedStatus(status);
      return payload.invitation;
    },
    [invitation.slug],
  );

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.from('[data-invitation-reveal]', {
        autoAlpha: 0,
        duration: 0.75,
        ease: 'power2.out',
        stagger: 0.08,
        y: 18,
      });
    }, pageRef);

    const heroImage = heroImageRef.current;
    if (!heroImage) return () => context.revert();

    const moveHero = gsap.quickTo(heroImage, 'y', {
      duration: 0.55,
      ease: 'power2.out',
    });
    const onScroll = () => moveHero(Math.min(window.scrollY * 0.1, 36));

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      context.revert();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'confirm_wedding_rsvp',
            title: 'Confirmar RSVP',
            description: 'Registra la confirmacion o declinacion de esta invitacion de boda.',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ACCEPTED', 'DECLINED'] },
                attendingCount: { type: 'integer', minimum: 0, maximum: invitation.maxGuests },
                note: { type: 'string', maxLength: 500 },
              },
              required: ['status'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              if (!input || typeof input !== 'object') {
                throw new Error('RSVP input must be an object.');
              }

              const values = input as Record<string, unknown>;
              const status = values.status;
              if (status !== 'ACCEPTED' && status !== 'DECLINED') {
                throw new Error('status must be ACCEPTED or DECLINED.');
              }

              const count = status === 'ACCEPTED'
                ? Math.max(
                    1,
                    Math.min(
                      invitation.maxGuests,
                      Number.isInteger(values.attendingCount)
                        ? Number(values.attendingCount)
                        : invitation.maxGuests,
                    ),
                  )
                : 0;
              const message = typeof values.note === 'string' ? values.note.slice(0, 500) : '';

              setDecision(status);
              setGuestCount(count || invitation.maxGuests);
              setNote(message);
              const saved = await persistRsvp(status, count, message);

              return {
                status: saved.status,
                attendingCount: saved.attendingCount,
                recipientName: saved.recipientName,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return () => lifecycle.abort();
    }

    return () => lifecycle.abort();
  }, [invitation.maxGuests, persistRsvp]);

  async function submitRsvp() {
    if (!decision) {
      setError('Selecciona una respuesta para continuar.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await persistRsvp(decision, guestCount, note);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo guardar tu respuesta.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#2b301f] md:px-6 md:py-8">
      <div ref={pageRef} className="mx-auto max-w-[440px] overflow-hidden bg-[#f4eee2] shadow-2xl">
        <section id="inicio" className="relative isolate min-h-[720px] overflow-hidden bg-[#2a2a1c] text-[#f4eee2]">
          <img
            ref={heroImageRef}
            src="/figma/cover.png"
            alt="Larissa y Luis"
            className="absolute inset-0 -z-30 h-[calc(100%+44px)] w-full object-cover grayscale"
          />
          <div className="absolute inset-0 -z-20 bg-[#2a2a1c]/65 mix-blend-multiply" />
          <img
            src="/figma/texture.png"
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-10 mix-blend-overlay"
          />
          <img
            src="/figma/gradient-hero.svg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
          />
          <img
            src="/figma/gradient-detail.svg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
          />

          <nav className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-[#f4eee2]/20 bg-[#2a2a1c]/25 px-5 py-4 text-[10px] uppercase">
            <a href="#inicio">Inicio</a>
            <a href="#detalles">Detalles</a>
            <a href="#rsvp">RSVP</a>
            <a href="#galeria">Galeria</a>
          </nav>

          <div className="flex min-h-[720px] flex-col items-center px-7 pb-12 pt-24 text-center">
            <p data-invitation-reveal className="text-sm">4 / 10 / 2026</p>
            <img
              data-invitation-reveal
              src="/figma/monogram.svg"
              alt="Monograma de Larissa y Luis"
              className="mt-6 h-16 w-16 object-contain"
            />
            <div className="mt-auto pb-2">
              <h1 data-invitation-reveal className="font-script text-6xl leading-none text-[#f4eee2] drop-shadow-lg">
                Larissa
              </h1>
              <p data-invitation-reveal className="font-script my-1 text-4xl leading-none text-[#c7b79c]">
                &amp;
              </p>
              <h2 data-invitation-reveal className="font-script text-6xl leading-none text-[#f4eee2] drop-shadow-lg">
                Luis
              </h2>
              <p data-invitation-reveal className="mt-9 text-sm font-bold uppercase text-[#d9c9ad]">
                Nos casamos
              </p>
            </div>
          </div>
        </section>

        <section className="paper-texture px-6 py-12 text-center text-[#313624]">
          <p data-invitation-reveal className="font-script text-3xl leading-none text-[#78805e]">Cuenta regresiva</p>
          <p data-invitation-reveal className="mt-2 text-xs uppercase text-[#6e735f]">Falta poco para celebrar juntos</p>
          <div data-invitation-reveal className="mt-6"><Countdown /></div>
        </section>

        <section className="bg-[#b4bd91] px-6 py-14 text-center text-[#2b3123]">
          <div data-invitation-reveal className="mx-auto max-w-[290px]">
            <p className="font-script text-4xl leading-none">Bienvenidos</p>
            <p className="mt-5 text-sm leading-6">
              Queremos que nos acompanes a celebrar el inicio de esta nueva etapa,
              rodeados de las personas que mas queremos.
            </p>
            <p className="mt-6 text-xs font-bold uppercase">Te esperamos</p>
          </div>
        </section>

        <section id="detalles" className="bg-[#fffaf0] px-6 py-12 text-[#313624]">
          <div data-invitation-reveal className="mb-8 text-center">
            <p className="font-script text-4xl leading-none text-[#78805e]">El gran dia</p>
            <p className="mt-2 text-xs uppercase text-[#6e735f]">Domingo, 4 de octubre de 2026</p>
          </div>
          <div data-invitation-reveal className="border-y border-[#d8d0bf] py-5">
            <DetailRow icon={<CalendarDays size={20} />} title="Ceremonia civil">
              <p>7:00 - 10:00 AM</p>
            </DetailRow>
            <DetailRow icon={<MapPin size={20} />} title="Ubicacion">
              <p>Los detalles de llegada se compartiran por este mismo enlace.</p>
            </DetailRow>
            <DetailRow icon={<Clock3 size={20} />} title="Recepcion">
              <p>Despues de la ceremonia, celebremos juntos.</p>
            </DetailRow>
          </div>
        </section>

        <section className="bg-[#424934] px-6 py-14 text-center text-[#f4eee2]">
          <Heart data-invitation-reveal className="mx-auto text-[#c7b79c]" size={24} strokeWidth={1.5} />
          <p data-invitation-reveal className="font-script mt-4 text-4xl leading-none">Tu lugar esta reservado</p>
          <p data-invitation-reveal className="mt-4 text-sm leading-6 text-[#e8e0d2]">
            <span className="font-semibold">{invitation.recipientName}</span>, esta invitacion contempla hasta{' '}
            <span className="font-semibold">{invitation.maxGuests}</span>{' '}
            {invitation.maxGuests === 1 ? 'persona.' : 'personas.'}
          </p>
        </section>

        <section id="rsvp" className="paper-texture px-6 py-12 text-[#313624]">
          <div data-invitation-reveal className="text-center">
            <p className="font-script text-4xl leading-none text-[#78805e]">Confirmacion</p>
            <p className="mt-3 text-sm leading-6 text-[#5c614d]">Tu respuesta nos ayuda a preparar cada detalle.</p>
          </div>

          {savedStatus ? (
            <div data-invitation-reveal className="mt-8 border border-[#aeb787] bg-[#fffaf0] p-6 text-center">
              {savedStatus === 'ACCEPTED' ? (
                <Check className="mx-auto text-[#78805e]" size={30} />
              ) : (
                <Heart className="mx-auto text-[#b48272]" size={30} />
              )}
              <p className="font-display mt-3 text-2xl">
                {savedStatus === 'ACCEPTED' ? 'Gracias, te esperamos.' : 'Gracias por avisarnos.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5c614d]">
                Tu respuesta fue registrada para {invitation.recipientName}.
              </p>
            </div>
          ) : (
            <div data-invitation-reveal className="mt-8 space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => setDecision('ACCEPTED')}
                  className={decision === 'ACCEPTED' ? 'h-11 bg-[#424934]' : 'h-11 bg-[#e8e1d3] text-[#313624] hover:bg-[#d9dfc2]'}
                >
                  <Check size={16} /> Si asistire
                </Button>
                <Button
                  type="button"
                  onClick={() => setDecision('DECLINED')}
                  className={decision === 'DECLINED' ? 'h-11 bg-[#a86558]' : 'h-11 bg-[#e8e1d3] text-[#313624] hover:bg-[#efd4cc]'}
                >
                  <X size={16} /> No podre asistir
                </Button>
              </div>

              {decision === 'ACCEPTED' && (
                <div className="border-y border-[#d8d0bf] py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users size={18} className="text-[#78805e]" />
                      <span>Personas que asistiran</span>
                    </div>
                    <div className="flex h-9 items-center border border-[#bfc5a4] bg-[#fffaf0]">
                      <button
                        type="button"
                        aria-label="Reducir cantidad de asistentes"
                        title="Reducir cantidad"
                        onClick={() => setGuestCount((count) => Math.max(1, count - 1))}
                        className="grid h-full w-9 place-items-center border-r border-[#bfc5a4] text-[#424934] hover:bg-[#ece6da]"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="grid h-full w-10 place-items-center text-sm tabular-nums">{guestCount}</span>
                      <button
                        type="button"
                        aria-label="Aumentar cantidad de asistentes"
                        title="Aumentar cantidad"
                        onClick={() => setGuestCount((count) => Math.min(invitation.maxGuests, count + 1))}
                        className="grid h-full w-9 place-items-center border-l border-[#bfc5a4] text-[#424934] hover:bg-[#ece6da]"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm text-[#5c614d]">
                  <MessageCircle size={17} className="text-[#78805e]" /> Mensaje o restriccion alimentaria
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full resize-none border border-[#c9c0af] bg-[#fffaf0] px-3 py-2 text-sm leading-6 outline-none focus:border-[#78805e] focus:ring-2 focus:ring-[#78805e]/20"
                />
              </label>

              {error && <p className="text-center text-sm text-[#a54e43]">{error}</p>}

              <Button
                type="button"
                onClick={submitRsvp}
                disabled={isSubmitting}
                className="h-12 w-full bg-[#424934] text-base hover:bg-[#313624]"
              >
                <Send size={17} /> {isSubmitting ? 'Guardando...' : 'Enviar confirmacion'}
              </Button>
            </div>
          )}
        </section>

        <section id="galeria" className="bg-[#f4eee2] px-5 py-12 text-[#313624]">
          <div data-invitation-reveal className="text-center">
            <p className="font-script text-4xl leading-none text-[#78805e]">Galeria</p>
            <p className="mt-2 text-xs font-bold uppercase text-[#5c614d]">Nuestros momentos</p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {galleryPhotos.map((photo) => (
              <figure key={photo.src} className={`gallery-frame gallery-frame-${photo.frame} aspect-[3/4] overflow-hidden bg-[#d8d0bf]`}>
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </figure>
            ))}
          </div>
        </section>

        <footer className="bg-[#2b301f] px-6 py-9 text-center text-[#e8e0d2]">
          <p className="font-script text-3xl leading-none">Larissa &amp; Luis</p>
          <p className="mt-3 text-xs">4 de octubre de 2026</p>
        </footer>
      </div>
    </main>
  );
}
