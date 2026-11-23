# Gestión Técnica v0.5.6

Versión de trabajo que incorpora el módulo DPMS ampliado.

## Novedades
- La ficha de inmueble incorpora tipo (vivienda, departamento/unidad funcional, PH, edificio, local, oficina, industrial, etc.), superficie cubierta y semicubierta, superficies por unidad, cantidad de plantas y cantidad de unidades funcionales.
- El DPMS recupera el inmueble vinculado al trabajo y permite definir el alcance: inmueble completo, unidad funcional o sector/instalación parcial.
- La superficie de aplicación se calcula como superficie cubierta + 50 % de semicubierta, según AEA 90364-7-770:2026, 770.8.1.1.
- Para viviendas se determina el grado de electrificación por superficie y se verifica la cantidad/distribución mínima de circuitos según 770.8.3.1, Tabla 770.8.I, 770.8.3.2 y Tabla 770.8.II.
- Se conserva el límite de 15 bocas por circuito y se presenta un detalle individual de circuitos y cargas específicas.
- El resultado muestra la cantidad de circuitos finales de uso general/especial y el factor de simultaneidad aplicado según Tabla 770.9.II.
- El detalle individual separa demanda de referencia y demanda DPMS luego del factor de simultaneidad; las cargas específicas muestran potencia, FP, FU, FS y demanda propia.
- El historial ahora permite abrir un cálculo guardado en modo consulta y recuperar sus datos como base de una nueva versión.
- Cada cálculo conserva copia de los datos del inmueble, alcance, entradas y resultados; las versiones previas no se sobrescriben.
- Cache de PWA actualizado.

## Importante
- Al eliminar un trabajo, también se eliminan sus cálculos DPMS asociados. La aplicación solicita confirmación e informa la cantidad antes de ejecutar la eliminación.
- Las fichas de inmuebles creadas en versiones anteriores no tenían campos de superficie. Para esos registros hay que entrar una vez en **Editar ficha** y completar superficie cubierta, semicubierta (si existe), plantas y, cuando corresponda, superficies por unidad.
- En edificios con varias unidades, para calcular una unidad se debe elegir **Unidad funcional** e ingresar la superficie de esa unidad; no usar la superficie total del edificio. Para un cálculo de edificio completo, elegir **Inmueble completo**. Los servicios comunes deben evaluarse con su alcance propio.
- El grado por superficie se aplica a viviendas dentro del alcance de AEA 90364-7-770. La cláusula 770.8.3.1 lo condiciona a corriente asignada ≤ 63 A e Icc presunta ≤ 10 kA; esta versión aún no verifica esos dos límites, por lo que muestra el grado por superficie como orientación sujeta a esa comprobación. No se extrapola automáticamente a locales, oficinas o edificios completos.
- La corriente trifásica que se muestra sigue siendo equivalente para carga equilibrada. No reemplaza la asignación de circuitos monofásicos/trifásicos por línea y el cálculo de la línea más cargada requerido por 770.9.3.1. Esa etapa queda pendiente antes de validar el DPMS como herramienta definitiva de dimensionamiento.
- Los valores FU/FS de cargas específicas son criterios de proyecto; no son factores universales fijados por la AEA.

## Ejecución local
Extraer la carpeta y ejecutar desde ella:

```powershell
py -m http.server 8000
```

Abrir `http://localhost:8000` en el navegador. No borrar los datos del navegador ni cambiar de navegador/origen para conservar la base local.


## Correcciones v0.5.5
- La selección de alcance sincroniza la superficie desde los campos del inmueble; departamentos y PH priorizan la superficie de unidad funcional y admiten la superficie general como respaldo cuando corresponde.
- Se fuerza la actualización de caché del service worker para evitar que el navegador mantenga JavaScript de una versión anterior.
- La eliminación individual del cálculo incluye confirmación explícita y manejo de errores.
- El historial conserva cada cálculo como registro independiente.


## Novedades v0.5.6 — Guía de cargas específicas
- Se incorpora una guía desplegable para explicar FP (factor de potencia), FU (factor de utilización) y FS (factor de simultaneidad), con fórmulas y criterios de selección.
- Se agrega un selector de tipo de carga: genérica, resistencia eléctrica, motor, bomba/presurizadora/riego y climatización.
- Al seleccionar un tipo se proponen valores iniciales de FP, FU y FS; el técnico puede editarlos libremente.
- Los valores sugeridos quedan identificados como estimativos. En motores, bombas y climatización, FP=0,90 es solo un valor provisional que debe reemplazarse por el dato de placa/fabricante cuando esté disponible.
- FU y FS no se asignan automáticamente como requisitos normativos: dependen del régimen de uso y de la simultaneidad prevista en la instalación. La referencia AEA 90364-7-770:2026, 770.9.2.1, remite al criterio del proyectista para las cargas específicas.
- No se modificó la estructura de IndexedDB; los cálculos guardados anteriormente permanecen disponibles.
