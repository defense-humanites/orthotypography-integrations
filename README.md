# orthotypography-integrations

Intégrations de [`@orthotypography/core`](https://github.com/defense-humanites/orthotypography)
pour les outils de l’écosystème JavaScript.

## Paquets

| Paquet | État | Rôle |
|---|---|---|
| `@orthotypography/rehype` | alpha non publiée | transformation et diagnostic des nœuds textuels HAST |
| `@orthotypography/astro` | prévu | configuration Astro au-dessus de rehype |

Le dépôt est organisé en espace de travail. Deno fournit l’outillage de
développement ; les paquets publiés visent l’écosystème JavaScript en général.

## Développement

```sh
deno task check
deno task test
deno task npm:check
```

La publication JSR et npm reste désactivée jusqu’à la première version publiée
du cœur.
