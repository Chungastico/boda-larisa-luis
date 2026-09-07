'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Heart, Minus, Plus, X } from 'lucide-react';
import gsap from 'gsap';
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

const galleryPages = [
  [galleryPhotos[0], galleryPhotos[1]],
  [galleryPhotos[2], galleryPhotos[3]],
  [galleryPhotos[4], galleryPhotos[5]],
  [galleryPhotos[6], galleryPhotos[7]],
  [galleryPhotos[8], galleryPhotos[9]],
  [galleryPhotos[10], galleryPhotos[11]],
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
    <div className="grid grid-cols-4 gap-1.5" aria-label="Cuenta regresiva">
      {parts.map((part, index) => (
        <div key={part.label} className="relative isolate h-[84px] overflow-hidden text-center text-[#2a2a1c]">
          <img
            src={index % 2 === 0
              ? '/figma/design/countdown-chip-olive.svg'
              : '/figma/design/countdown-chip-cream.svg'}
            alt=""
            className="absolute inset-0 -z-10 h-full w-full"
          />
          <p className="pt-4 font-display text-[22px] font-bold leading-none tabular-nums">
            {String(part.value).padStart(2, '0')}
          </p>
          <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.6px]">{part.label}</p>
        </div>
      ))}
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
    const scroller = pageRef.current;
    if (!heroImage || !scroller) return () => context.revert();

    const moveHero = gsap.quickTo(heroImage, 'y', {
      duration: 0.55,
      ease: 'power2.out',
    });
    const onScroll = () => moveHero(Math.min(scroller.scrollTop * 0.045, 26));

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      context.revert();
      scroller.removeEventListener('scroll', onScroll);
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
    <main className="h-[100svh] overflow-hidden bg-[#24291e] md:p-5">
      <div
        ref={pageRef}
        className="invitation-scroller mx-auto h-full max-w-[480px] overflow-y-auto bg-[#f4eee2] shadow-2xl"
      >
        <section id="inicio" className="story-screen relative isolate overflow-hidden bg-[#2a2a1c] text-[#f4eee2]">
          <nav className="relative z-20 grid h-[58px] grid-cols-[34px_repeat(5,minmax(0,1fr))] items-center border-b border-[#2a2a1c]/15 bg-[#c7b79c] px-3 text-center text-[8px] font-bold uppercase tracking-[0.4px] text-[#2a2a1c]">
            <a href="#inicio" aria-label="Inicio" className="grid place-items-center"><img src="/figma/design/navbar-mark.svg" alt="" className="h-7 w-6" /></a>
            <a href="#bienvenida" className="whitespace-nowrap hover:opacity-60">Bienvenida</a>
            <a href="#vestimenta" className="whitespace-nowrap hover:opacity-60">Vestimenta</a>
            <a href="#ubicacion" className="whitespace-nowrap hover:opacity-60">Ubicacion</a>
            <a href="#rsvp" className="whitespace-nowrap hover:opacity-60">RSVP</a>
            <a href="#galeria" className="whitespace-nowrap hover:opacity-60">Galeria</a>
          </nav>

          <div className="relative flex min-h-[calc(100svh-58px)] flex-col items-center overflow-hidden px-7 pb-14 pt-14 text-center">
            <img
              ref={heroImageRef}
              src="/figma/photos/camisa-celeste-vestido.png"
              alt="Larissa y Luis frente a la iglesia"
              className="absolute inset-0 -z-30 h-[calc(100%+34px)] w-full object-cover object-[52%_center] saturate-[0.72]"
            />
            <div className="absolute inset-0 -z-20 bg-[#2a2a1c]/55 mix-blend-multiply" />
            <img src="/figma/gradient-hero.svg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-90" />
            <img src="/figma/gradient-detail.svg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
            <img src="/figma/texture.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.08] mix-blend-overlay" />

            <p data-invitation-reveal className="text-[13px] font-bold tracking-[4px] text-[#f4eee2]">4 · 10 · 2026</p>
            <img data-invitation-reveal src="/figma/monogram.svg" alt="Monograma de Larissa y Luis" className="mt-5 h-[73px] w-[73px] object-contain brightness-0 invert" />
            <div className="mt-auto">
              <h1 data-invitation-reveal className="font-script text-[64px] leading-[0.78] text-[#f4eee2] drop-shadow-md">Larissa</h1>
              <p data-invitation-reveal className="font-script my-2 text-[38px] leading-none text-[#c7b79c]">&amp;</p>
              <h2 data-invitation-reveal className="font-script text-[64px] leading-[0.78] text-[#f4eee2] drop-shadow-md">Luis</h2>
              <p data-invitation-reveal className="mt-11 text-[15px] font-bold uppercase tracking-[2.8px] text-[#c7b79c]">Nos casamos</p>
            </div>
          </div>
        </section>

        <section className="story-screen relative isolate flex flex-col justify-center overflow-hidden bg-[#2a2a1c] px-6 text-center text-[#f4eee2]">
          <img src="/figma/photos/hand.png" alt="" className="absolute inset-0 -z-30 h-full w-full object-cover object-center opacity-35 saturate-[0.5]" />
          <div className="absolute inset-0 -z-20 bg-[#2a2a1c]/65 mix-blend-multiply" />
          <img src="/figma/design/countdown-gradient-a.svg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />
          <img src="/figma/design/countdown-gradient-b.svg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />
          <div>
            <p data-invitation-reveal className="font-script text-[38px] leading-none text-[#c7b79c]">Cuenta regresiva</p>
            <p data-invitation-reveal className="mt-3 text-[17px] font-bold uppercase tracking-[0.3px]">Falta poco para celebrar juntos</p>
          </div>
          <div data-invitation-reveal className="mt-16"><Countdown /></div>
        </section>

        <section id="bienvenida" className="story-screen flex flex-col items-center justify-center bg-[#8b9574] px-7 text-center text-[#2a2a1c]">
          <div data-invitation-reveal className="w-full max-w-[374px]">
            <figure className="mx-auto max-w-[300px] overflow-hidden rounded-t-[94px] border-[5px] border-[#f4eee2] bg-[#f4eee2]">
              <img src="/figma/photos/vestido-y-camisa-celeste.png" alt="Larissa y Luis juntos" className="aspect-[3/4] w-full object-cover" loading="lazy" />
            </figure>
            <p className="font-script mt-5 text-[38px] leading-none">¡Bienvenidos!</p>
            <p className="mx-auto mt-5 max-w-[335px] text-[13px] leading-[1.75]">
              Queremos que nos acompanes a celebrar el inicio de esta nueva etapa, rodeados de las personas que mas queremos. El amor se multiplica cuando se comparte.
            </p>
            <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.5px]">¡Te esperamos!</p>
          </div>
        </section>

        <section className="story-screen paper-texture relative isolate flex flex-col items-center justify-center overflow-hidden px-7 text-center text-[#2a2a1c]">
          <img src="/figma/design/ceremony-texture.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.14] mix-blend-multiply" />
          <div data-invitation-reveal className="max-w-[355px]">
            <p className="font-script text-[38px] leading-none text-[#8b9574]">Ceremonia civil</p>
            <p className="mt-4 text-[21px] font-bold">7:00 - 10:00 AM</p>
            <div className="mx-auto mt-7 h-px w-20 bg-[#c7b79c]" />
            <p className="mt-7 text-[13px] leading-[1.75]">
              La ceremonia civil se realizara en un ambiente intimo, seguida de un desayuno para celebrar los primeros minutos como esposos. Un momento sencillo, cercano y lleno de carino.
            </p>
          </div>
        </section>

        <section id="vestimenta" className="story-screen relative isolate overflow-hidden bg-[#2a2a1c] text-center text-[#2a2a1c]">
          <img src="/figma/photos/boda-all-black.png" alt="Larissa y Luis" className="absolute inset-x-0 top-0 -z-30 h-[65%] w-full object-cover object-center" loading="lazy" />
          <div className="absolute inset-x-0 top-0 -z-20 h-[65%] bg-[#2a2a1c]/55 mix-blend-multiply" />
          <img src="/figma/design/dress-card.svg" alt="" className="absolute inset-x-0 bottom-0 -z-10 h-[48%] w-full" />
          <div data-invitation-reveal className="absolute inset-x-7 bottom-[7%]">
            <p className="font-script text-[38px] leading-none text-[#8b9574]">Vestimenta</p>
            <p className="mt-4 text-[20px] font-bold">Formal elegante</p>
            <p className="mx-auto mt-5 max-w-[325px] text-[13px] leading-[1.75]">Agradecemos que nos acompanes con tonos neutros, oscuros o suaves para celebrar juntos esta ocasion tan especial.</p>
          </div>
        </section>

        <section id="ubicacion" className="story-screen relative isolate flex flex-col overflow-hidden bg-[#2a2a1c] text-center">
          <div className="relative h-[49%] shrink-0 overflow-hidden rounded-b-[46px]">
            <img src="/figma/photos/puerta-del-diablo.png" alt="Vista de la celebracion" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-[#2a2a1c]/50 mix-blend-multiply" />
          </div>
          <div data-invitation-reveal className="flex flex-1 flex-col items-center justify-center px-7 text-[#f4eee2]">
            <p className="font-script text-[38px] leading-none text-[#c7b79c]">Ubicacion</p>
            <p className="mt-4 text-[23px] font-bold">Restaurante El Mirador</p>
            <p className="mt-2 text-[11px] tracking-[0.7px] text-[#c7b79c]">SAN SALVADOR, EL SALVADOR</p>
            <p className="mt-6 max-w-[340px] text-[13px] leading-[1.7] text-[#f4eee2]/80">Un espacio para encontrarnos, brindar y celebrar cada momento de este dia.</p>
            <a href="https://www.google.com/maps/search/?api=1&query=Restaurante+El+Mirador+San+Salvador" target="_blank" rel="noreferrer" className="relative mt-7 grid h-[54px] w-[184px] place-items-center text-[12px] font-bold uppercase tracking-[0.8px] text-[#2a2a1c]">
              <img src="/figma/design/map-button.svg" alt="" className="absolute inset-0 h-full w-full" />
              <span className="relative">Ver mapa</span>
            </a>
          </div>
        </section>

        <section id="rsvp" className="story-screen relative isolate flex flex-col justify-center overflow-hidden bg-[#8b9574] px-7 text-center text-[#2a2a1c]">
          <img src="/figma/photos/sentados-en-piedra.png" alt="" className="absolute inset-0 -z-30 h-full w-full object-cover opacity-35 saturate-[0.55]" loading="lazy" />
          <div className="absolute inset-0 -z-20 bg-[#8b9574]/65 mix-blend-multiply" />
          <div data-invitation-reveal>
            <p className="font-script text-[38px] leading-none">RSVP</p>
            <p className="mt-3 text-[19px] font-bold">¿Nos acompanaras?</p>
            <p className="mx-auto mt-4 max-w-[335px] text-[12px] leading-[1.65]">Agradecemos confirmar tu asistencia antes del 15 de septiembre de 2026.</p>
          </div>

          {savedStatus ? (
            <div data-invitation-reveal className="mx-auto mt-8 max-w-[348px] border border-[#2a2a1c]/25 bg-[#f4eee2]/90 px-6 py-7">
              {savedStatus === 'ACCEPTED' ? <Check className="mx-auto" size={28} /> : <Heart className="mx-auto" size={28} />}
              <p className="font-script mt-4 text-[31px] leading-none">{savedStatus === 'ACCEPTED' ? '¡Te esperamos!' : 'Gracias por avisarnos'}</p>
              <p className="mt-4 text-[12px] leading-5">Tu respuesta fue registrada para {invitation.recipientName}.</p>
            </div>
          ) : (
            <div data-invitation-reveal className="mx-auto mt-7 w-full max-w-[348px]">
              <p className="text-[13px] font-bold">Hemos reservado:</p>
              <p className="mt-1 text-[24px] font-bold leading-tight">{invitation.recipientName}</p>
              <p className="mt-1 text-[12px]">{invitation.maxGuests} {invitation.maxGuests === 1 ? 'espacio' : 'espacios'} para adultos</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setDecision('ACCEPTED')} className="relative h-[46px] overflow-hidden text-[12px] font-bold uppercase tracking-[0.45px] text-[#f4eee2]">
                  <img src="/figma/design/rsvp-yes-button.svg" alt="" className="absolute inset-0 h-full w-full" />
                  <span className="relative">Si, asistire</span>
                </button>
                <button type="button" onClick={() => setDecision('DECLINED')} className={`h-[46px] border border-[#2a2a1c] text-[12px] font-bold uppercase tracking-[0.45px] transition-colors ${decision === 'DECLINED' ? 'bg-[#2a2a1c] text-[#f4eee2]' : 'bg-[#f4eee2]/45 text-[#2a2a1c]'}`}>
                  No podre asistir
                </button>
              </div>

              {decision === 'ACCEPTED' && (
                <div className="mt-4 flex items-center justify-center gap-4 text-[12px]">
                  <span>Personas que asistiran</span>
                  <div className="flex h-8 items-center border border-[#2a2a1c] bg-[#f4eee2]/75">
                    <button type="button" aria-label="Reducir cantidad de asistentes" title="Reducir cantidad" onClick={() => setGuestCount((count) => Math.max(1, count - 1))} className="grid h-full w-8 place-items-center border-r border-[#2a2a1c]/25"><Minus size={14} /></button>
                    <span className="grid h-full w-8 place-items-center tabular-nums">{guestCount}</span>
                    <button type="button" aria-label="Aumentar cantidad de asistentes" title="Aumentar cantidad" onClick={() => setGuestCount((count) => Math.min(invitation.maxGuests, count + 1))} className="grid h-full w-8 place-items-center border-l border-[#2a2a1c]/25"><Plus size={14} /></button>
                  </div>
                </div>
              )}

              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} aria-label="Mensaje o restriccion alimentaria" placeholder="Mensaje o restriccion alimentaria (opcional)" className="mt-4 w-full resize-none border border-[#2a2a1c]/30 bg-[#f4eee2]/75 px-3 py-2 text-[12px] leading-5 outline-none placeholder:text-[#2a2a1c]/60 focus:border-[#2a2a1c]" />
              {error && <p className="mt-3 text-[12px] font-bold text-[#7d3028]">{error}</p>}
              <button type="button" onClick={submitRsvp} disabled={isSubmitting} className="relative mt-4 h-[60px] w-full overflow-hidden text-[13px] font-bold uppercase tracking-[0.65px] text-[#f4eee2] disabled:opacity-60">
                <img src="/figma/design/rsvp-confirm-button.svg" alt="" className="absolute inset-0 h-full w-full" />
                <span className="relative">{isSubmitting ? 'Guardando...' : 'Confirmar asistencia'}</span>
              </button>
            </div>
          )}
        </section>

        {galleryPages.map((photos, pageIndex) => (
          <section key={photos[0].src} id={pageIndex === 0 ? 'galeria' : undefined} className="story-screen paper-texture relative isolate flex flex-col overflow-hidden px-5 py-10 text-[#2a2a1c]">
            <img src="/figma/design/gallery-texture.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25 mix-blend-multiply" />
            <header data-invitation-reveal className="shrink-0 text-center">
              <p className="font-script text-[38px] leading-none text-[#8b9574]">Galeria</p>
              <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.5px]">Nuestros momentos</p>
            </header>
            <div className="mt-7 grid min-h-0 flex-1 grid-cols-2 gap-3">
              {photos.map((photo) => (
                <figure key={photo.src} className={`gallery-frame-${photo.frame} h-full overflow-hidden bg-[#c7b79c] shadow-sm`}>
                  <img src={photo.src} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
                </figure>
              ))}
            </div>
            <p className="mt-5 text-center text-[10px] font-bold tracking-[1px] text-[#8b9574]">{String(pageIndex + 1).padStart(2, '0')} / {String(galleryPages.length).padStart(2, '0')}</p>
          </section>
        ))}

        <footer className="story-screen relative isolate flex flex-col items-center justify-center overflow-hidden bg-[#2a2a1c] px-7 text-center text-[#f4eee2]">
          <img src="/figma/photos/playa-oscuro.png" alt="" className="absolute inset-0 -z-30 h-full w-full object-cover opacity-30 saturate-[0.45]" loading="lazy" />
          <div className="absolute inset-0 -z-20 bg-[#2a2a1c]/75 mix-blend-multiply" />
          <img data-invitation-reveal src="/figma/monogram.svg" alt="Monograma de Larissa y Luis" className="h-20 w-20 brightness-0 invert" />
          <p data-invitation-reveal className="mt-8 text-[16px] font-bold uppercase tracking-[3px]">Larissa y Luis</p>
          <p data-invitation-reveal className="mt-4 text-[12px] tracking-[2px] text-[#c7b79c]">4 · 10 · 2026</p>
        </footer>
      </div>
    </main>
  );
}
