<template>
  <client-only>
    <vue-final-modal
      v-model="isOpen"
      classes="flex justify-center items-center h-screen overflow-auto p-4"
      content-class="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200"
    >
      <div class="flex flex-col bg-white">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center space-x-3">
            <div class="p-2 rounded-full" :class="headerBgClass">
              <svg class="w-6 h-6" :class="headerIconColor" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-800">{{ errorTitle }}</h2>
              <p class="text-xs text-gray-500">Fase: {{ phaseText }} | Tipo: {{ categoryBadge }}</p>
            </div>
          </div>
          <button class="text-gray-400 hover:text-gray-600 focus:outline-none p-1" @click="isOpen = false">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <!-- Main Explanation Box -->
          <div class="p-4 rounded-lg border text-sm" :class="boxClass">
            <p class="font-semibold text-gray-800 mb-1">{{ errorSummary }}</p>
            <p class="text-gray-600">{{ errorDescription }}</p>
          </div>

          <!-- Checklist / Suggested Actions -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <h4 class="font-semibold mb-2 flex items-center">
              <svg class="w-4 h-4 mr-1.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Pasos para resolver este problema:
            </h4>
            <ul class="space-y-1.5 list-disc list-inside text-blue-800">
              <li v-for="(tip, idx) in recommendedSteps" :key="idx">
                <span class="font-medium">{{ tip.title }}:</span> {{ tip.desc }}
              </li>
            </ul>
          </div>

          <!-- Technical Details Toggle -->
          <div class="border border-gray-200 rounded-lg overflow-hidden">
            <button 
              class="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-left font-medium text-xs text-gray-700 flex justify-between items-center focus:outline-none transition-colors"
              @click="showDetails = !showDetails"
            >
              <span>Detalles Técnicos y Registro de Comandos USB ({{ logs.length }} eventos)</span>
              <span>{{ showDetails ? '▲ Ocultar' : '▼ Mostrar' }}</span>
            </button>

            <div v-if="showDetails" class="p-4 bg-gray-900 text-gray-200 font-mono text-xs space-y-3">
              <div>
                <span class="text-gray-400">Error: </span>
                <span class="text-red-400 font-semibold">{{ rawErrorName }}: {{ rawErrorMessage }}</span>
              </div>
              <div v-if="rpcCommand">
                <span class="text-gray-400">Comando RPC: </span>
                <span class="text-yellow-400">{{ rpcCommand }}</span>
              </div>
              <div v-if="lastUsbCmd">
                <span class="text-gray-400">Última orden USB: </span>
                <span class="text-cyan-400">{{ lastUsbCmd }}</span>
              </div>

              <!-- Log table -->
              <div class="mt-2 border-t border-gray-800 pt-2">
                <div class="text-gray-400 mb-1">Historial USB reciente:</div>
                <div class="max-h-48 overflow-y-auto space-y-1 pr-1 text-[11px]">
                  <div 
                    v-for="(item, i) in logs" 
                    :key="i"
                    class="flex items-start space-x-2 py-0.5 border-b border-gray-800"
                  >
                    <span class="text-gray-500 whitespace-nowrap">{{ item.time }}</span>
                    <span 
                      class="px-1 py-0.2 rounded text-[10px] font-bold uppercase"
                      :class="item.result === 'OK' ? 'bg-green-900 text-green-300' : (item.result === 'ERROR' ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300')"
                    >
                      {{ item.result }}
                    </span>
                    <span class="text-yellow-300 whitespace-nowrap">{{ item.cmd }}</span>
                    <span class="text-gray-300 flex-1 truncate">{{ item.details }}</span>
                    <span v-if="item.error" class="text-red-400 truncate max-w-[150px]">{{ item.error }}</span>
                  </div>
                  <div v-if="logs.length === 0" class="text-gray-600 italic">No hay registros USB disponibles.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-100 focus:outline-none transition-colors flex items-center space-x-1"
            @click="copyDiagnostic"
          >
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
            </svg>
            <span>{{ copied ? '¡Copiado al portapapeles!' : 'Copiar Diagnóstico Completo' }}</span>
          </button>

          <div class="flex space-x-2">
            <button
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none transition-colors"
              @click="isOpen = false"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </vue-final-modal>
  </client-only>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { usbDiag, UsbLogItem } from './usbLogger';

@Component
export default class ErrorMessage extends Vue {
  isOpen = false;
  category = '';
  error: any = null;
  phase = '';
  showDetails = false;
  copied = false;
  logs: UsbLogItem[] = [];
  rpcCommand = '';
  lastUsbCmd = '';

  handleError(error: any, phase: 'connection' | 'operation') {
    this.error = error;
    this.phase = phase;
    this.showDetails = false;
    this.copied = false;
    this.logs = error?.usbLogs || usbDiag.getRecentLogs();
    this.rpcCommand = error?.rpcCommand || '';
    this.lastUsbCmd = error?.lastUsbDetails?.cmd || '';

    const msg = (error?.message || String(error)).toLowerCase();
    const name = (error?.name || '').toLowerCase();

    if (msg.includes('unable to claim interface') || msg.includes('claiminterface')) {
      this.category = 'claim_busy';
    } else if (msg.includes('libusb') || msg.includes('packet') || msg.includes('handshake')) {
      this.category = 'libusb';
    } else if (name === 'securityerror' || msg.includes('permission')) {
      this.category = 'udev';
    } else if (name === 'networkerror' || msg.includes('disconnected')) {
      this.category = 'disconnected';
    } else {
      this.category = 'unknown';
    }

    this.isOpen = true;
  }

  get phaseText() {
    return this.phase === 'connection' ? 'Conexión Inicial' : 'Operación / Transferencia';
  }

  get categoryBadge() {
    switch (this.category) {
      case 'claim_busy': return 'Puerto USB Ocupado';
      case 'libusb': return 'Protocolo TI LibUSB';
      case 'udev': return 'Permisos de Dispositivo';
      case 'disconnected': return 'Desconexión';
      default: return 'Error General';
    }
  }

  get headerBgClass() {
    return this.category === 'libusb' ? 'bg-amber-100' : 'bg-red-100';
  }

  get headerIconColor() {
    return this.category === 'libusb' ? 'text-amber-600' : 'text-red-600';
  }

  get boxClass() {
    return this.category === 'libusb'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-red-50 border-red-200 text-red-900';
  }

  get errorTitle() {
    switch (this.category) {
      case 'claim_busy': return 'El puerto USB está bloqueado o en uso';
      case 'libusb': return 'Error de Protocolo TI (LibUSB Handshake)';
      case 'udev': return 'Permiso Denegado en el puerto USB';
      case 'disconnected': return 'Calculadora Desconectada';
      default: return 'Error en la Comunicación USB';
    }
  }

  get errorSummary() {
    switch (this.category) {
      case 'claim_busy':
        return 'Chromium no pudo reclamar la interfaz USB de la calculadora.';
      case 'libusb':
        return 'Chromium se conectó al puerto USB, pero la calculadora no respondió adecuadamente al protocolo de Texas Instruments.';
      case 'udev':
        return 'El sistema operativo bloqueó el acceso directo al dispositivo USB.';
      case 'disconnected':
        return 'Se perdió la conexión física con la calculadora durante la operación.';
      default:
        return `Ocurrió un error inesperado: ${this.rawErrorMessage}`;
    }
  }

  get errorDescription() {
    switch (this.category) {
      case 'claim_busy':
        return 'Esto ocurre cuando otra aplicación en Windows (como TI-Nspire Computer Software) tiene la calculadora abierta con acceso exclusivo.';
      case 'libusb':
        return 'La librería web-libnspire envió los paquetes de sincronización inicial (Handshake 0x54), pero la calculadora devolvió un error o se agotó el tiempo de espera (Timeout).';
      case 'udev':
        return 'Verifica que tu usuario tenga permisos de acceso a dispositivos USB o que el driver WinUSB esté activo.';
      default:
        return 'Revisa los registros técnicos a continuación para conocer el comando exacto que falló.';
    }
  }

  get recommendedSteps() {
    switch (this.category) {
      case 'claim_busy':
        return [
          { title: 'Cerrar Software Oficial', desc: 'Cierra totalmente TI-Nspire CX CAS Student Software en Windows.' },
          { title: 'Reconectar Cable', desc: 'Desconecta el cable USB de la calculadora y vuelve a enchufarlo.' },
          { title: 'Reintentar', desc: 'Pulsa el botón de conectar nuevamente.' },
        ];
      case 'libusb':
        return [
          { title: 'Pantalla Encendida', desc: 'Presiona la tecla [ON] en la calculadora. Si la pantalla se apaga o entra en reposo, el USB se corta.' },
          { title: 'Pantalla Principal', desc: 'Asegúrate de estar en la pantalla de inicio (Home) de la calculadora, sin cuadros de diálogo o menús modales abiertos.' },
          { title: 'Cerrar Software TI', desc: 'Verifica que no quede ningún proceso en segundo plano de Texas Instruments interfiriendo.' },
          { title: 'Reconectar directo a la PC', desc: 'Usa un puerto USB directo de tu computadora (evita adaptadores o hubs USB múltiples).' },
        ];
      default:
        return [
          { title: 'Reconectar', desc: 'Desconecta y vuelve a conectar la calculadora.' },
          { title: 'Verificar Encendido', desc: 'Presiona [ON] para encender la calculadora.' },
          { title: 'Copiar Diagnóstico', desc: 'Copia el reporte técnico con el botón inferior para analizarlo.' },
        ];
    }
  }

  get rawErrorName() {
    return this.error?.name || 'Error';
  }

  get rawErrorMessage() {
    return this.error?.message || String(this.error || 'Desconocido');
  }

  async copyDiagnostic() {
    const report = [
      `### Reporte Diagnóstico n-Link WebUSB`,
      `- **Fecha:** ${new Date().toLocaleString()}`,
      `- **Fase:** ${this.phase}`,
      `- **Categoría:** ${this.category}`,
      `- **Error:** ${this.rawErrorName}: ${this.rawErrorMessage}`,
      `- **Comando RPC:** ${this.rpcCommand || 'N/A'}`,
      `- **Última orden USB:** ${this.lastUsbCmd || 'N/A'}`,
      ``,
      `#### Registro de Comandos USB:`,
      '```',
      ...this.logs.map((l) => `[${l.time}] [${l.result}] ${l.cmd} - ${l.details}${l.error ? ' | ERR: ' + l.error : ''}`),
      '```',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2500);
    } catch (e) {
      console.error('Error al copiar al portapapeles:', e);
    }
  }
}
</script>
