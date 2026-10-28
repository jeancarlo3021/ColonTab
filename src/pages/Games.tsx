import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Game = 'gato' | 'memoria'

export function Games() {
  const [game, setGame] = useState<Game>('gato')
  return (
    <main className="menu-page">
      <header className="topbar">
        <Link to=".." relative="path" className="icon-btn" aria-label="Volver">←</Link>
        <h1>Juegos</h1>
      </header>
      <nav className="tabs">
        <button className={`tab ${game === 'gato' ? 'active' : ''}`} onClick={() => setGame('gato')}>❌⭕ Gato</button>
        <button className={`tab ${game === 'memoria' ? 'active' : ''}`} onClick={() => setGame('memoria')}>🧠 Memoria</button>
      </nav>
      {game === 'gato' ? <TicTacToe /> : <Memory />}
    </main>
  )
}

// ───────── Gato (tres en raya) contra la máquina ─────────
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
type Cell = 'X' | 'O' | null

function winner(b: Cell[]): Cell | 'empate' | null {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  return b.every(Boolean) ? 'empate' : null
}

function cpuMove(b: Cell[]): number {
  const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  // gana si puede, bloquea si debe, si no centro o al azar
  for (const mark of ['O', 'X'] as const) {
    for (const i of free) {
      const t = [...b]
      t[i] = mark
      if (winner(t) === mark) return i
    }
  }
  if (b[4] === null) return 4
  return free[Math.floor(Math.random() * free.length)]
}

function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [score, setScore] = useState({ tu: 0, cpu: 0 })
  const result = winner(board)

  function play(i: number) {
    if (board[i] || result) return
    const next = [...board]
    next[i] = 'X'
    if (!winner(next)) next[cpuMove(next)] = 'O'
    const w = winner(next)
    if (w === 'X') setScore((s) => ({ ...s, tu: s.tu + 1 }))
    if (w === 'O') setScore((s) => ({ ...s, cpu: s.cpu + 1 }))
    setBoard(next)
  }

  return (
    <section className="game">
      <p className="muted">Tú {score.tu} · {score.cpu} Máquina</p>
      <div className="ttt">
        {board.map((c, i) => (
          <button key={i} className="ttt-cell" onClick={() => play(i)} aria-label={`Casilla ${i + 1}`}>
            {c === 'X' ? '❌' : c === 'O' ? '⭕' : ''}
          </button>
        ))}
      </div>
      {result && (
        <>
          <p className="game-result">{result === 'empate' ? 'Empate 🤝' : result === 'X' ? '¡Ganaste! 🎉' : 'Ganó la máquina 🤖'}</p>
          <button className="btn btn-primary" onClick={() => setBoard(Array(9).fill(null))}>Jugar otra vez</button>
        </>
      )}
    </section>
  )
}

// ───────── Memoria con emojis de comida ─────────
const FOODS = ['🌮', '🍕', '🍔', '🍩', '🍣', '🥑', '🌶️', '🍉']

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function Memory() {
  const [cards, setCards] = useState(() => shuffle([...FOODS, ...FOODS]))
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)

  useEffect(() => {
    if (open.length !== 2) return
    const [a, b] = open
    if (cards[a] === cards[b]) {
      setFound((f) => new Set(f).add(cards[a]))
      setOpen([])
      return
    }
    const t = setTimeout(() => setOpen([]), 700)
    return () => clearTimeout(t)
  }, [open, cards])

  function flip(i: number) {
    if (open.length === 2 || open.includes(i) || found.has(cards[i])) return
    if (open.length === 1) setMoves((m) => m + 1)
    setOpen((o) => [...o, i])
  }

  function reset() {
    setCards(shuffle([...FOODS, ...FOODS]))
    setOpen([])
    setFound(new Set())
    setMoves(0)
  }

  const done = found.size === FOODS.length
  return (
    <section className="game">
      <p className="muted">Movimientos: {moves}</p>
      <div className="memory">
        {cards.map((c, i) => {
          const shown = open.includes(i) || found.has(c)
          return (
            <button key={i} className={`mem-card ${shown ? 'shown' : ''}`} onClick={() => flip(i)} aria-label={shown ? c : 'Carta oculta'}>
              {shown ? c : '?'}
            </button>
          )
        })}
      </div>
      {done && (
        <>
          <p className="game-result">¡Completado en {moves} movimientos! 🎉</p>
          <button className="btn btn-primary" onClick={reset}>Jugar otra vez</button>
        </>
      )}
    </section>
  )
}
