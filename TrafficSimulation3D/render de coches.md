# Renderizado de modelos 3D de coches

## El problema

Al principio los coches se renderizaban como cubos simples. El archivo `obj_loader.js` existia pero estaba completamente vacio, entonces aunque habia archivos OBJ de los modelos coche_ciudadano.obj y borracho.obj, no se podian cargar. Cuando se intento cargar el archivo OBJ, Vite no lo encontraba porque estaba fuera de la carpeta visualization, entonces devolvia HTML en lugar del archivo. Ademas el formato de las caras era `v//vn` que tiene el indice de textura vacio, y eso rompia el parser. Por ultimo los archivos OBJ de Blender traian widgets de animacion y planos de referencia que se renderizaban como paredes raras flotando.

## La solucion

Se implemento la funcion `loadObj()` en `obj_loader.js` que lee el archivo linea por linea y parsea vertices, normales y caras, convirtiendolos en arrays que WebGL entiende. Se manejo el caso especial del formato `v//vn` verificando si el string del indice de textura esta vacio antes de parsearlo. Los archivos OBJ se copiaron a `visualization/public/car_files/` porque Vite sirve automaticamente esa carpeta. Se agrego logica para ignorar las caras de objetos que empiezan con WGT o Plane, pero se siguen parseando todos los vertices para que los indices no se rompan. Se desactivo el face culling con `gl.disable(gl.CULL_FACE)` para que se vean ambos lados de las caras y el modelo se vea solido en lugar de tener huecos.

Ahora cuando la aplicacion carga, `loadCarModel()` hace fetch del archivo OBJ, lo parsea con `loadObj()` y crea un `carModelRef` que todos los coches comparten. Cada coche usa el mismo modelo 3D pero con diferente posicion, escala y color aleatorio. El backend envia la posicion y direccion de cada coche en puntos cardinales y el frontend los renderiza con iluminacion Phong.
