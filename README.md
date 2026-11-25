# SIGESTEC · Cambio 41 · v0.5.35

## Revisión del catálogo y nuevas referencias
- Se corrige el tratamiento de **boca completa**: AAIERIC publica un importe directo; Electro Instalador presenta tareas desglosadas y no un precio completo con alcance estrictamente equivalente. El catálogo conserva el valor directo AAIERIC y deja de promediarlo con un valor inexistente de EI. La diferencia entre una reconstrucción por componentes y el precio directo queda explicitada para evitar comparaciones falsas.
- Se mantiene la distinción entre canalización metálica y PVC, tanto embutida como a la vista. No se extrapola automáticamente el valor de cableado de una modalidad de cañería a otra.
- Se incorporan referencias complementarias de mercado de Clickie (octubre 2026), AppMaestro (noviembre 2026), Revista CIFRAS (agosto-septiembre 2026) y Muovi (junio 2026, citado por fuente secundaria). Se muestran en un bloque independiente, con su alcance geográfico y límites metodológicos; no se mezclan ni promedian con las referencias profesionales del catálogo.
- Se incorporan en un bloque separado los honorarios profesionales del Colegio Público de Ingenieros de Formosa (septiembre 2026). No se confunden con mano de obra de ejecución ni alteran los precios del catálogo.
- Las referencias complementarias se presentan como contraste de mercado, no como tarifas oficiales ni como precios automáticamente aplicables a todas las regiones. Los valores de Chubut y Río Negro se presentan como referencias regionales estimativas, elaboradas a partir de referencias sectoriales y relevamientos de mercado; no constituyen tarifas oficiales.

## Ítems personalizados
- Se incorpora el botón **Agregar ítem personalizado** al catálogo. Permite definir descripción, categoría, unidad y precio unitario.
- Los ítems se pueden editar, eliminar y agregar a presupuestos. El precio se puede ajustar por región sin alterar el precio base definido.
- Los ítems personalizados se guardan en el nuevo store `labor_custom_items` y se incluyen en las copias de seguridad y restauraciones.

## Compatibilidad y datos
- IndexedDB sube de versión 7 a 8 mediante una actualización incremental que crea únicamente el nuevo store `labor_custom_items`; no elimina ni recrea stores existentes.
- No se reordenan ni renumeran los conceptos existentes (`mo-1` a `mo-70` y los IDs ya existentes), para preservar overrides regionales guardados.
- No se alteran presupuestos existentes: sus importes, descripciones y referencias históricas permanecen como fueron guardados.
- Se actualiza la caché del service worker a `gestion-tecnica-shell-v46` para que el navegador descargue los archivos nuevos.

## Ajuste de cantidades
- En las cantidades de los renglones del presupuesto, las flechas del campo numérico avanzan de a unidades enteras (`step=1`) en lugar de décimas. El valor ya cargado no se redondea ni se modifica automáticamente.

## Compatibilidad de esta actualización
- No cambia la estructura de IndexedDB ni requiere migración. Se conservan los datos y presupuestos existentes.
- Se actualiza la caché del service worker a `gestion-tecnica-shell-v47`.

## Instalación
Reemplazar los archivos de la versión anterior por los de este paquete, conservando el origen de datos local del navegador. No borrar datos del sitio ni limpiar IndexedDB.

## Presentación de valores regionales
- Se retira toda mención visible a porcentajes de ajuste para Chubut y Río Negro.
- Se mantiene el criterio de cálculo regional interno y los importes existentes.
- Catálogo, referencias y presupuestos PDF presentan los importes como valores regionales estimativos basados en referencias sectoriales y relevamientos de mercado.
- Se limpian también las etiquetas históricas de presupuestos guardados al mostrarlas o exportarlas, sin modificar los datos almacenados.
- No cambia IndexedDB ni se requiere migración.
- Se actualiza la caché del service worker a `gestion-tecnica-shell-v48`.


## Ajustes comerciales en presupuestos
- Se agrega un sector de **Ajustes comerciales** al armador de presupuestos.
- Permite aplicar un descuento porcentual o un importe fijo. El descuento no puede superar el subtotal.
- Permite agregar impuestos mediante una tasa porcentual configurable; el cálculo se realiza sobre el subtotal luego del descuento. Puede dejarse en 0% cuando no corresponda.
- Incorpora un precio final manual opcional para acordar un importe especial con un cliente. Al completarlo, reemplaza el total calculado y el documento muestra el total calculado y el ajuste comercial. Al dejarlo vacío, vuelve al cálculo automático.
- El PDF y el listado de presupuestos guardados muestran el total final, y el PDF discrimina subtotal, descuento, impuestos y ajuste comercial cuando corresponda.
- Los presupuestos anteriores siguen siendo compatibles: si no tienen ajustes guardados, se interpretan como descuento 0, impuestos 0 y total automático.
- No se modifican precios unitarios del catálogo ni los ítems históricos de cada presupuesto.
- No cambia IndexedDB ni requiere migración.
- Se actualiza la caché del service worker a `gestion-tecnica-shell-v49`.


## Numeración correlativa de presupuestos
- Los presupuestos nuevos reciben un número correlativo con formato `0001/AAAA`, tomando el año de la fecha del presupuesto.
- La secuencia se conserva en el store existente `settings`, por lo que no se reinicia al cerrar la aplicación ni al eliminar un presupuesto.
- Al asignar un número se considera también el mayor correlativo ya existente para ese año, evitando duplicados al actualizar desde versiones anteriores.
- Los presupuestos históricos conservan su número original; los nuevos utilizan el formato correlativo.
- No cambia la versión ni la estructura de IndexedDB; se reutiliza el store `settings`.
- Se actualiza la caché del service worker a `gestion-tecnica-shell-v50`.
