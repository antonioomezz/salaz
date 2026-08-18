'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type AudioSettings } from '@/lib/audioSettings';
import { playSfx } from '@/lib/sounds';
import { Headphones, Mic, Screen } from './icons';

type Props = {
  settings: AudioSettings;
  onChange: (next: AudioSettings) => void;
  onClose: () => void;
  /** 0-100, medido do microfone ao vivo */
  inputLevel: number;
  inVoice: boolean;
};

export function SettingsModal({ settings, onChange, onClose, inputLevel, inVoice }: Props) {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [semPermissao, setSemPermissao] = useState(false);

  useEffect(() => {
    const listar = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputs(devices.filter((d) => d.kind === 'audioinput'));
        setOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        // sem permissão concedida os nomes vêm vazios
        setSemPermissao(devices.some((d) => d.kind === 'audioinput' && !d.label));
      } catch {
        setSemPermissao(true);
      }
    };
    void listar();
    navigator.mediaDevices.addEventListener?.('devicechange', listar);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', listar);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const trocarSaida = navigator.mediaDevices && 'setSinkId' in HTMLMediaElement.prototype;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-ink-500 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-400 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Configurações de voz</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-mute transition hover:bg-ink-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {semPermissao && (
            <p className="rounded bg-blurple/15 px-3 py-2 text-xs text-soft">
              Entre em um canal de voz uma vez para o navegador liberar os nomes dos dispositivos.
            </p>
          )}

          {/* ------------------------------------------------ entrada */}
          <Section icon={<Mic className="h-4 w-4" />} title="Dispositivo de entrada">
            <select
              value={settings.inputDeviceId}
              onChange={(e) => set('inputDeviceId', e.target.value)}
              className="w-full rounded bg-ink-900 px-3 py-2 text-sm text-bright outline-none"
            >
              <option value="">Padrão do sistema</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </Section>

          <Slider
            label="Volume de entrada"
            value={settings.inputVolume}
            max={200}
            onChange={(v) => set('inputVolume', v)}
            hint={settings.inputVolume === 100 ? 'sinal original, sem processamento' : undefined}
          />

          {/* ------------------------------------------------ teste do mic */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-soft uppercase">
                Testar microfone
              </span>
              <span className="text-[11px] text-mute">
                {inVoice ? 'fale e veja a barra mexer' : 'entre em um canal de voz para testar'}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink-900">
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${inputLevel}%`,
                  background: inputLevel > 80 ? 'var(--color-danger)' : 'var(--color-online)',
                }}
              />
            </div>
          </div>

          {/* ------------------------------------------------ saída */}
          <Section icon={<Headphones className="h-4 w-4" />} title="Dispositivo de saída">
            {trocarSaida ? (
              <select
                value={settings.outputDeviceId}
                onChange={(e) => set('outputDeviceId', e.target.value)}
                className="w-full rounded bg-ink-900 px-3 py-2 text-sm text-bright outline-none"
              >
                <option value="">Padrão do sistema</option>
                {outputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Saída ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-mute">
                Este navegador não deixa escolher a saída pela página — troque pelo sistema.
              </p>
            )}
          </Section>

          <Slider
            label="Volume de saída"
            value={settings.outputVolume}
            max={100}
            onChange={(v) => set('outputVolume', v)}
          />

          {/* ------------------------------------------------ processamento */}
          <Section icon={<Screen className="h-4 w-4" />} title="Processamento de voz">
            <div className="space-y-1">
              <Toggle
                label="Cancelamento de eco"
                hint="Desligue se sua voz sumir enquanto alguém transmite a tela com som"
                checked={settings.echoCancellation}
                onChange={(v) => set('echoCancellation', v)}
              />
              <Toggle
                label="Redução de ruído"
                hint="Corta ventilador e teclado; pode cortar voz baixa demais"
                checked={settings.noiseSuppression}
                onChange={(v) => set('noiseSuppression', v)}
              />
              <Toggle
                label="Ganho automático"
                hint="Nivela o volume da sua voz sozinho"
                checked={settings.autoGainControl}
                onChange={(v) => set('autoGainControl', v)}
              />
            </div>
            <p className="mt-2 text-[11px] text-mute">
              Mudar qualquer um destes recaptura o microfone na hora, sem derrubar a chamada.
            </p>
          </Section>

          {/* ------------------------------------------------ efeitos sonoros */}
          <Section title="Efeitos sonoros">
            <Toggle
              label="Sons do app"
              hint="Entrar e sair da chamada, mensagens, microfone"
              checked={settings.sfxEnabled}
              onChange={(v) => {
                set('sfxEnabled', v);
                if (v) playSfx('join');
              }}
            />
            {settings.sfxEnabled && (
              <div className="mt-3">
                <Slider
                  label="Volume dos sons"
                  value={settings.sfxVolume}
                  max={100}
                  onChange={(v) => set('sfxVolume', v)}
                  onRelease={() => playSfx('message')}
                />
              </div>
            )}
          </Section>
        </div>

        <div className="flex items-center justify-between border-t border-ink-400 px-6 py-4">
          <button
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="text-xs text-mute transition hover:text-white"
          >
            Restaurar padrões
          </button>
          <button
            onClick={onClose}
            className="rounded bg-blurple px-5 py-2 text-sm font-medium text-white transition hover:bg-blurple-dark"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-soft uppercase">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  max,
  onChange,
  onRelease,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  onRelease?: () => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-bold tracking-wide text-soft uppercase">{label}</span>
        <span className="text-[11px] text-mute">{hint ?? `${value}%`}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onRelease}
        onTouchEnd={onRelease}
        className="w-full accent-blurple"
      />
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    // o clique vale no rótulo inteiro, não só no interruptor
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between gap-4 py-1.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm text-bright">{label}</span>
        {hint && <span className="block text-[11px] leading-tight text-mute">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-online' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  );
}
