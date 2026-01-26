# Sistema de Economia - Pokemon Marketplace

## Resumen

El sistema economico tiene 3 pilares:
1. **Monedas diarias** - Ingreso garantizado
2. **Compra directa** - Precio fijo por Pokemon
3. **Huevos** - Apuesta con chance de mejor valor

---

## 1. Sistema de Rareza

La rareza se calcula automaticamente del `capture_rate` de PokeAPI:

```javascript
function calculateRarity(species) {
  if (species.is_mythical) return 'mythical';
  if (species.is_legendary) return 'legendary';
  if (species.capture_rate <= 3) return 'epic';
  if (species.capture_rate <= 45) return 'epic';
  if (species.capture_rate <= 100) return 'rare';
  if (species.capture_rate <= 200) return 'uncommon';
  return 'common';
}
```

### Distribucion de Pokemon por Rareza

| Rareza | Cantidad aprox. | Ejemplos |
|--------|-----------------|----------|
| Common | ~350 | Pidgey, Rattata, Caterpie, Weedle, Zubat, Magikarp |
| Uncommon | ~300 | Pikachu, Bulbasaur, Charmander, Squirtle, Jigglypuff |
| Rare | ~250 | Eevee, Dratini, Lapras, Snorlax, Chansey |
| Epic | ~100 | Dragonite, Tyranitar, Salamence, Metagross |
| Legendary | ~60 | Mewtwo, Lugia, Rayquaza, Dialga, Palkia |
| Mythical | ~25 | Mew, Celebi, Jirachi, Deoxys, Arceus, Magearna |

---

## 2. Precios de Compra Directa

```javascript
const PRICES = {
  common:    100,
  uncommon:  250,
  rare:      500,
  epic:      1000,
  legendary: 5000,
  mythical:  10000
};
```

### Logica de Precio

- **Precio = PRICES[rarity]**
- Sin variacion por Pokemon individual
- Shiny tiene mismo precio (1/4096 chance al obtener)

---

## 3. Sistema de Huevos

Los huevos permiten obtener Pokemon por un precio menor, pero con resultado aleatorio.

### Tipos de Huevos

| Huevo | Precio | Pool | Descripcion |
|-------|--------|------|-------------|
| Comun | 75 | Common + Uncommon | Para principiantes |
| Raro | 350 | Rare + Epic | Buena relacion precio/valor |
| Legendario | 2500 | Legendary + Mythical | Garantizado legendario+ |
| **Misterio** | **500** | **TODOS** | La gran apuesta |

### Probabilidades por Huevo

#### Huevo Comun (75 monedas)
```
Common:   70% --> Valor esperado: 70 monedas
Uncommon: 30% --> Valor esperado: 75 monedas
-------------------------------------------------
Total valor esperado: 0.70 * 100 + 0.30 * 250 = 145 monedas
Ganancia esperada: 145 - 75 = +70 monedas (BUENO)
```

#### Huevo Raro (350 monedas)
```
Rare: 70% --> Valor esperado: 350 monedas
Epic: 30% --> Valor esperado: 300 monedas
-------------------------------------------------
Total valor esperado: 0.70 * 500 + 0.30 * 1000 = 650 monedas
Ganancia esperada: 650 - 350 = +300 monedas (MUY BUENO)
```

#### Huevo Legendario (2500 monedas)
```
Legendary: 90% --> Valor esperado: 4500 monedas
Mythical:  10% --> Valor esperado: 1000 monedas
-------------------------------------------------
Total valor esperado: 0.90 * 5000 + 0.10 * 10000 = 5500 monedas
Ganancia esperada: 5500 - 2500 = +3000 monedas (EXCELENTE)
```

#### Huevo Misterio (500 monedas) - LA APUESTA
```
Common:    50.0% --> 50 monedas de valor
Uncommon:  25.0% --> 62.5 monedas de valor
Rare:      15.0% --> 75 monedas de valor
Epic:       7.0% --> 70 monedas de valor
Legendary:  2.5% --> 125 monedas de valor
Mythical:   0.5% --> 50 monedas de valor
-------------------------------------------------
Total valor esperado: 432.5 monedas
Ganancia esperada: 432.5 - 500 = -67.5 monedas (NEGATIVO!)
```

**Por que comprar Huevo Misterio si es perdida?**
- 3% chance de obtener algo que vale 5000-10000
- "Emocion del gacha"
- Potencial de saltar etapas de grindeo

---

## 4. Implementacion Tecnica

### Weighted Random Selection

```typescript
interface WeightedItem {
  value: string;
  weight: number;
}

function weightedRandom(items: WeightedItem[]): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1].value;
}

// Configuracion de Huevo Misterio
const MYSTERY_EGG_WEIGHTS: WeightedItem[] = [
  { value: 'common',    weight: 50 },
  { value: 'uncommon',  weight: 25 },
  { value: 'rare',      weight: 15 },
  { value: 'epic',      weight: 7 },
  { value: 'legendary', weight: 2.5 },
  { value: 'mythical',  weight: 0.5 }
];
```

### Hatching Logic

```typescript
interface HatchResult {
  pokemon: PokemonSpecies;
  isShiny: boolean;
  rarity: Rarity;
}

async function hatchEgg(eggType: EggType, userId: string): Promise<HatchResult> {
  // 1. Determinar rareza segun tipo de huevo
  const rarity = selectRarityForEgg(eggType);

  // 2. Obtener todos los pokemon de esa rareza
  const pool = await getPokemonByRarity(rarity);

  // 3. Seleccionar uno al azar
  const randomIndex = Math.floor(Math.random() * pool.length);
  const pokemon = pool[randomIndex];

  // 4. Determinar si es shiny (1/4096)
  const isShiny = Math.random() < (1 / 4096);

  // 5. Crear registro en base de datos
  await createUserPokemon({
    userId,
    speciesId: pokemon.id,
    isShiny,
    obtainedMethod: 'egg_hatch'
  });

  // 6. Actualizar pokedex si es nuevo
  await updatePokedex(userId, pokemon.id);

  return { pokemon, isShiny, rarity };
}

function selectRarityForEgg(eggType: EggType): Rarity {
  switch (eggType) {
    case 'common':
      return weightedRandom([
        { value: 'common', weight: 70 },
        { value: 'uncommon', weight: 30 }
      ]);

    case 'rare':
      return weightedRandom([
        { value: 'rare', weight: 70 },
        { value: 'epic', weight: 30 }
      ]);

    case 'legendary':
      return weightedRandom([
        { value: 'legendary', weight: 90 },
        { value: 'mythical', weight: 10 }
      ]);

    case 'mystery':
      return weightedRandom(MYSTERY_EGG_WEIGHTS);
  }
}
```

---

## 5. Monedas Diarias

### Streak System

```typescript
const DAILY_REWARDS = {
  day1: 100,
  day2: 150,
  day3: 175,
  day4: 200,
  day5Plus: 200  // Cap
};

async function claimDailyReward(userId: string): Promise<number> {
  const user = await getUser(userId);

  // Verificar si ya reclamo hoy
  if (isToday(user.lastDailyClaim)) {
    throw new Error('Already claimed today');
  }

  // Calcular streak
  let newStreak: number;
  if (isYesterday(user.lastDailyClaim)) {
    // Continua el streak
    newStreak = user.streakDays + 1;
  } else {
    // Reset streak
    newStreak = 1;
  }

  // Calcular recompensa
  const reward = calculateReward(newStreak);

  // Actualizar usuario
  await updateUser(userId, {
    coins: user.coins + reward,
    streakDays: newStreak,
    lastDailyClaim: new Date()
  });

  return reward;
}

function calculateReward(streakDay: number): number {
  if (streakDay >= 5) return DAILY_REWARDS.day5Plus;
  if (streakDay === 4) return DAILY_REWARDS.day4;
  if (streakDay === 3) return DAILY_REWARDS.day3;
  if (streakDay === 2) return DAILY_REWARDS.day2;
  return DAILY_REWARDS.day1;
}
```

---

## 6. Economia de Intercambios

### Reglas de Trade

1. Solo se pueden tradear Pokemon que posees
2. Un Pokemon solo puede estar en 1 trade activo a la vez
3. Pokemon en equipo pueden ser tradeados (se quitan del equipo)
4. Se puede agregar monedas a la oferta
5. Trades expiran en 24 horas

### Valor Justo Sugerido

El sistema puede mostrar "valor justo" basado en rareza:

```typescript
function calculateTradeValue(pokemonIds: string[]): number {
  const pokemons = await getUserPokemons(pokemonIds);
  return pokemons.reduce((sum, p) => sum + PRICES[p.species.rarity], 0);
}

function isTradeBalanced(
  initiatorPokemon: string[],
  initiatorCoins: number,
  receiverPokemon: string[]
): boolean {
  const initiatorValue = calculateTradeValue(initiatorPokemon) + initiatorCoins;
  const receiverValue = calculateTradeValue(receiverPokemon);

  // Tolerancia del 20%
  const ratio = initiatorValue / receiverValue;
  return ratio >= 0.8 && ratio <= 1.2;
}
```

---

## 7. Balanceo Economico

### Ingresos Diarios Promedio
- Login diario (streak 5+): 200 monedas
- Promedio real (algunos dias skip): ~150 monedas

### Tiempo para Obtener Pokemon

| Rareza | Precio | Dias de grindeo |
|--------|--------|-----------------|
| Common | 100 | 0.5 dias |
| Uncommon | 250 | 1.5 dias |
| Rare | 500 | 3 dias |
| Epic | 1000 | 6 dias |
| Legendary | 5000 | 1 mes |
| Mythical | 10000 | 2 meses |

### Estrategia Optima del Jugador

1. **Principiante**: Comprar huevos comunes para llenar pokedex rapido
2. **Intermedio**: Huevos raros para mejor ROI
3. **Avanzado**: Huevos legendarios para completar coleccion
4. **Gambling**: Huevos misterio para tentar suerte

### Anti-Farming Measures

- Monedas solo por daily reward (no por acciones)
- Cap de streak en 200 monedas
- No venta de Pokemon por monedas (solo trade)
