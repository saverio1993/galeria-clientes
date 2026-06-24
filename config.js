/* ============================================================
   CONFIGURACIÓN — edita este archivo con tus datos
   ============================================================ */

window.GALLERY_CONFIG = {
  // Nombre que aparece en el header y como título del sitio
  brandName: 'Galería de Saverio',

  // Título principal de la página
  introTitle: 'Elige tus favoritas',

  // Correo al que llegará la selección del cliente (vía mailto:)
  receiverEmail: 'saveriomanrrique19@gmail.com',

  // Cantidad de fotos que el cliente debe seleccionar (entre min y max)
  minSelections: 3,
  maxSelections: 5,

  // Asunto del correo (se completa con el nombre y la cantidad)
  subjectPrefix: 'Selección de fotos',

  // Nota opcional que se agrega al final del cuerpo del correo
  galleryNote: 'Gracias por revisar la galería. Si necesitas otra selección avísame.',

  // Repo donde se publica la galería (usado por admin.html para subir fotos)
  repo: {
    owner: 'saverio1993',
    repo:  'galeria-clientes',
    branch: 'main',
  },

  // Tamaño máximo por foto al subir desde admin.html (MB)
  maxFileSizeMB: 25,
};
