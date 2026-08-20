// Utilitário de Alertas Sonoros e Notificações com Web Audio API nativa
// Funciona instantaneamente sem necessidade de download de arquivos de áudio externos

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API não suportada ou bloqueada:', e);
    return null;
  }
}

/**
 * Toca o som de alerta quando a Recepção/Secretária faz o CHECK-IN do paciente.
 * Notifica o Terapeuta com um som harmonioso de sino duplo (Ding-Dong / G5 -> C6).
 */
export function playCheckinChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Nota 1: G5 (783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nota 2: C6 (1046.50 Hz) - 150ms depois
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.15);
    
    gain2.gain.setValueAtTime(0.001, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.error('Erro ao reproduzir som de check-in:', err);
  }
}

/**
 * Toca o som de alerta quando o Terapeuta LIBERA A SALA / chama o paciente.
 * Notifica a Recepção/Secretária com um acorde triplo ascendente brilhante (E5 -> G#5 -> B5).
 */
export function playRoomReleasedChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0, dur: 0.25, vol: 0.18 },    // E5
      { freq: 830.61, time: 0.1, dur: 0.25, vol: 0.2 },  // G#5
      { freq: 987.77, time: 0.2, dur: 0.45, vol: 0.22 }, // B5
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(vol, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  } catch (err) {
    console.error('Erro ao reproduzir som de sala liberada:', err);
  }
}
