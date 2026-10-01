import type { Messages } from './en';

export const es: Messages = {
  viewTitle: 'AgentHub',
  openView: 'Abrir AgentHub',
  emptyTitle: 'Todavía no hay sesión',
  emptyBody: 'Los agentes aparecerán aquí cuando estén conectados.',

  settingsAgents: 'Agentes',
  settingsDefaultAgent: 'Agente por defecto',
  settingsDefaultAgentDesc: 'Agente que se usa en las sesiones nuevas.',
  settingsRedetect: 'Volver a detectar agentes',
  settingsRedetectDesc:
    'Busca de nuevo los comandos de los agentes, por ejemplo tras instalar uno.',
  settingsRedetectButton: 'Detectar',
  settingsAddAgent: 'Añadir un agente personalizado',
  settingsAddAgentDesc: 'Cualquier agente que hable Agent Client Protocol (ACP) por stdio.',
  settingsAddAgentButton: 'Añadir agente',
  settingsCustomAgentLabel: 'Agente personalizado {n}',
  settingsEdit: 'Editar',
  settingsDelete: 'Eliminar',
  settingsDetecting: 'Detectando…',
  settingsAvailable: 'Disponible: {path}',
  settingsMissing: 'No encontrado. {hint}',
  settingsAgentError: 'No disponible: {message}',
  settingsDisabled: 'Desactivado',
  settingsLabel: 'Nombre',
  settingsCommand: 'Comando',
  settingsCommandDesc: 'Programa a ejecutar, por nombre o ruta absoluta.',
  settingsArgs: 'Argumentos',
  settingsArgsDesc: 'Un argumento por línea.',
  settingsEnv: 'Variables de entorno',
  settingsEnvDesc:
    'Una CLAVE=valor por línea. Se guardan en texto plano en los datos del plugin: evita secretos.',
  settingsConfig: 'Opciones iniciales',
  settingsConfigDesc:
    'Una opción=valor por línea, p. ej. mode=plan. Se aplican al iniciar una sesión.',

  settingsSessions: 'Sesiones',
  settingsCwd: 'Directorio de trabajo',
  settingsCwdDesc: 'Carpeta donde se ejecutan los agentes.',
  settingsCwdVault: 'Raíz del vault',
  settingsCwdCustom: 'Carpeta personalizada',
  settingsCustomCwd: 'Carpeta personalizada',
  settingsCustomCwdDesc: 'Ruta absoluta.',
  settingsInstructions: 'Instrucciones del vault',
  settingsInstructionsDesc:
    'Se envían al agente con el primer mensaje. {{configDir}} se sustituye por la carpeta de configuración de Obsidian.',
  settingsSendWith: 'Enviar mensaje con',
  settingsSendEnter: 'Intro (Mayús+Intro para nueva línea)',
  settingsSendModEnter: 'Ctrl/Cmd+Intro',
  settingsShowThoughts: 'Mostrar el razonamiento del agente',
  settingsShowThoughtsDesc: 'Despliega por defecto los bloques de razonamiento.',
  settingsDebug: 'Panel de depuración',
  settingsDebugDesc:
    'Muestra en la vista la salida cruda del agente (stderr y mensajes desconocidos).',

  settingsEnvironment: 'Entorno',
  settingsLoginShell: 'Usar el PATH del shell de inicio como respaldo',
  settingsLoginShellDesc:
    'Si no se encuentra un comando, pide el PATH a tu shell de inicio (más lento, solo cuando hace falta).',
  settingsExtraPath: 'Carpetas extra de PATH',
  settingsExtraPathDesc: 'Una carpeta por línea; se buscan antes que el resto.',

  hintInstall: 'Instálalo con: {command}',
  hintLogin: 'Inicia sesión ejecutando `{command}` en una terminal.',
  hintUnsupported: 'El modo "{transport}" todavía no está soportado.',
  hintNoCommand: 'No hay comando configurado.',
};
