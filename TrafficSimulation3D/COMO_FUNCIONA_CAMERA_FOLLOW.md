# Sistema de camara follow con coordenadas esfericas

## Como funciona la camara normalmente

La camara usa un sistema de coordenadas esfericas en lugar de cartesianas directas. En vez de guardar la posicion XYZ de la camara, se guarda un punto target (objetivo) y tres valores que describen donde esta la camara respecto a ese target: distancia, azimut (rotacion horizontal) y elevacion (rotacion vertical).

Para convertir de coordenadas esfericas a cartesianas se usan estas formulas:
- `x = target.x + distancia * cos(elevacion) * sin(azimut)`
- `y = target.y + distancia * sin(elevacion)`
- `z = target.z + distancia * cos(elevacion) * cos(azimut)`

La elevacion es el angulo vertical. Cuando elevacion es 0, la camara esta al nivel del target. Cuando es PI/2 (90 grados), la camara esta directamente arriba. El azimut es el angulo horizontal que permite rotar alrededor del target como si la camara estuviera en un carrusel.

## El problema del follow mode

Para seguir a un coche se necesita que el target de la camara se mueva con el coche cada frame. El coche tiene una propiedad `posArray` que devuelve `[x, y, z]` de su posicion actual. En cada frame se actualiza `target.x`, `target.y` y `target.z` con la posicion del coche.

La camara entonces recalcula automaticamente su posicion usando las formulas de arriba, pero ahora el target se esta moviendo entonces la camara lo sigue. Es como si el carrusel se moviera por la ciudad con el coche en el centro.

## Vista top-down

Para lograr vista desde arriba se usa `elevacion = PI/2 - 0.1`. PI/2 son exactamente 90 grados pero se resta 0.1 radianes (unos 5.7 grados) porque la camara tiene limites de elevacion para evitar bugs matematicos cuando esta exactamente a 90 grados.

Con elevacion de casi 90 grados, el componente vertical `y = distancia * sin(PI/2)` se hace casi igual a la distancia completa. Los componentes horizontales `x` y `z` se hacen casi cero porque `cos(PI/2)` es casi cero. Entonces la camara queda directamente arriba del target.

La distancia controla que tan arriba esta. Con distancia = 15, la camara esta 15 unidades arriba del coche. El azimut ya no importa mucho en top-down porque girar horizontalmente alrededor de un punto cuando estas arriba te deja en casi el mismo lugar.

## Pan offset

Hay una variable `panOffset` que es un vector `[x, y, z]` que se suma a la posicion final de la camara. Esto permite mover la camara sin cambiar el target ni los angulos. En follow mode se resetea a `[0, 0, 0]` para que la camara siga limpiamente sin desviaciones.

## Controles en follow mode

En modo follow los controles de panning (WASD) se desactivan porque mover la camara mientras sigue a algo no tiene sentido. La rotacion (flechas) sigue funcionando para que puedas cambiar el angulo de vista. El zoom (+/-) modifica `followDistance` en lugar de `distance` normal, y luego `distance` se actualiza a `followDistance` cada frame en `updateFollowMode()`.

Cuando seleccionas un coche del dropdown, se busca en el array de coches con `cars.find(c => c.id === carId)` y se guarda la referencia en `camera.followTarget`. Luego `updateFollowMode()` usa esa referencia para obtener la posicion actual cada frame.
