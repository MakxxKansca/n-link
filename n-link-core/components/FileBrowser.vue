<template>
  <div class="h-full">
    <div class="border-b py-2 px-2 header flex">
      <ol class="flex">
        <li v-for="(part, i) in parts" :key="i" class="" :class="{active: i === parts.length - 1}">
          <span class="inline-block cursor-pointer bg-gray-200 px-4 py-1 rounded-full"
                @click="goToIndex(i)">{{ part || 'Home' }}</span>
          <img v-if="i < parts.length - 1" class="inline img-fix" src="~feather-icons/dist/icons/chevron-right.svg"/>
        </li>
      </ol>
      <div class="flex-grow"/>
      <device-queue :device="$devices.devices[dev]"/>
    </div>
    <div class="h-full flex w-full body">
      <div class="overflow-auto h-full py-4 flex-grow">
        <file-view v-if="!loading && files && files.length" :files="files" :show-hidden="showHidden" @nav="path = $event"
                   @select="selected = $event"/>
        <div v-else-if="!loading && files && files.length === 0 && !loadError" class="flex flex-col items-center justify-center h-full text-gray-500 p-6 text-center">
          <svg class="w-16 h-16 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <p class="text-base font-medium text-gray-700">Esta carpeta no tiene archivos .tns visibles</p>
          <p class="text-sm text-gray-500 mt-1">Si tus archivos no son .tns, prueba marcar la casilla <strong class="text-gray-700">"Include hidden files"</strong> en el panel izquierdo.</p>
        </div>
        <div v-else-if="loading" class="flex flex-col items-center justify-center h-full">
          <div class="lds-dual-ring"/>
          <p class="text-sm text-gray-500 mt-3">Leyendo archivos de la calculadora...</p>
        </div>
        <div v-else-if="loadError" class="flex flex-col items-center justify-center h-full p-6 text-center">
          <div class="p-4 max-w-md bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p class="font-bold text-base mb-1">Error al leer los archivos</p>
            <p class="text-xs font-mono text-red-600 mb-3">{{ loadError }}</p>
            <div class="flex items-center justify-center space-x-2">
              <button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium focus:outline-none transition-colors"
                      :disabled="retrying"
                      @click="retryLoad">
                {{ retrying ? 'Reintentando...' : 'Reintentar lectura' }}
              </button>
              <button class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-medium focus:outline-none transition-colors"
                      @click="showLogs = !showLogs">
                {{ showLogs ? 'Ocultar diagnóstico' : 'Ver diagnóstico USB' }}
              </button>
            </div>
            <div v-if="showLogs" class="mt-3 text-left bg-gray-900 text-green-400 p-3 rounded text-xs font-mono max-h-48 overflow-auto select-all">
              <div v-for="(log, idx) in recentLogs" :key="idx" class="border-b border-gray-800 py-0.5">
                <span class="text-gray-500">[{{ log.time }}]</span> <strong>{{ log.cmd }}</strong>: {{ log.result }} {{ log.details }}
                <div v-if="log.dataHex" class="text-gray-400 text-[10px] pl-2">{{ log.dataHex }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="overflow-auto h-full px-4 pt-4 w-48 flex-shrink-0 border-l">
        <file-data :files="selected" :show-hidden="showHidden" :dev="dev" :path="path" :native-upload="nativeUpload"/>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {Component, Prop, Vue, Watch} from 'vue-property-decorator';
import FileView from './FileView.vue';
import type {FileInfo} from "./devices";
import FileData from "./FileData.vue";
import DeviceQueue from "./DeviceQueue.vue";

@Component({
  asyncComputed: {
    files: {
      async get(this: FileBrowser) {
        this.updateIndex;
        console.log('[FileBrowser] Solicitando listDir para:', this.path);
        try {
          const raw = await this.$devices.listDir(this.dev, this.path);
          console.log('[FileBrowser] listDir respuesta:', raw);
          this.loadError = '';
          if (!raw || !Array.isArray(raw)) return [];
          return raw.map(file => ({
            ...file,
            path: this.path ? `${this.path}/${file.path}` : file.path
          }));
        } catch (e: any) {
          console.error('[FileBrowser] Error al listar directorio:', e);
          this.loadError = e?.message || String(e);
          try {
            (globalThis as any).__USB_DIAG__?.sendToServer?.();
          } catch (_) {}
          return [];
        }
      },
      default: null,
    }
  },
  components: {DeviceQueue, FileData, FileView}
})
export default class FileBrowser extends Vue {
  @Prop({type: String, required: true}) private dev!: string;
  @Prop({type: Boolean, default: false}) private showHidden!: boolean;
  @Prop({type: Boolean, default: false}) private nativeUpload!: boolean;
  path = '';
  updateIndex = 0;
  loadError = '';
  retrying = false;
  showLogs = false;
  selected: FileInfo[] = [];
  files!: FileInfo[] | null;

  @Watch('path')
  onPathChange() {
    this.selected = [];
  }

  get parts() {
    return this.path.split('/');
  }

  get loading() {
    return this.$asyncComputed.files.updating;
  }

  get recentLogs() {
    return (globalThis as any).__USB_DIAG__?.getRecentLogs() || [];
  }

  async retryLoad() {
    this.retrying = true;
    this.loadError = '';
    this.updateIndex++;
    try {
      await (globalThis as any).__USB_DIAG__?.sendToServer?.();
    } catch (_) {}
    setTimeout(() => {
      this.retrying = false;
    }, 1500);
  }

  goToIndex(i: number) {
    this.path = this.parts.slice(0, i + 1).join('/');
    this.updateIndex++;
  }
}
</script>

<style scoped lang="scss">
.header {
  height: 50px;
}

.body {
  padding-bottom: 50px;
}

.active span {
  @apply bg-blue-500 text-white;
}

.img-fix {
  margin-top: -1px;
}

.lds-dual-ring {
  display: inline-block;
  width: 80px;
  height: 80px;
}

.lds-dual-ring:after {
  $color: theme('colors.gray.400');
  content: " ";
  display: block;
  width: 64px;
  height: 64px;
  margin: 8px;
  border-radius: 50%;
  border: 6px solid $color;
  border-color: $color transparent $color transparent;
  animation: lds-dual-ring 1.2s linear infinite;
}

</style>
