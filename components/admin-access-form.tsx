'use client';

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AdminAccessForm({ configured }: { configured: boolean }) {
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(payload.error ?? 'No se pudo abrir el panel.');
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo abrir el panel.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="paper-texture grid min-h-screen place-items-center px-5 py-10 text-[#313624]">
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="w-full max-w-sm border border-[#d8d0bf] bg-[#fffaf0] p-7 shadow-lg">
        <div className="grid size-11 place-items-center bg-[#424934] text-[#f4eee2]">
          <LockKeyhole size={20} />
        </div>
        <p className="font-display mt-6 text-3xl leading-none">Panel de boda</p>
        <p className="mt-3 text-sm leading-6 text-[#5c614d]">Acceso para Larissa y Luis.</p>

        {configured ? (
          <>
            <label htmlFor="admin-access-token" className="mt-6 block text-sm">
              <span className="mb-2 block">Codigo de acceso</span>
              <Input
                id="admin-access-token"
                type="password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                autoComplete="current-password"
                className="h-10 rounded-none border-[#c9c0af] bg-[#fffaf0]"
              />
            </label>
            {error && <p className="mt-3 text-sm text-[#a54e43]">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-6 h-10 w-full rounded-none bg-[#424934]">
              {loading ? 'Verificando...' : 'Entrar al panel'}
            </Button>
          </>
        ) : (
          <p className="mt-6 border-l-2 border-[#b48272] pl-3 text-sm leading-6 text-[#6e735f]">
            Acceso no configurado.
          </p>
        )}
      </form>
    </main>
  );
}
