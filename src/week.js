// Weekly capacity, editable on the Plan page and read by the day strip.
import { useEffect, useState } from 'react'
import { WEEK } from './data'

const KEY = 'projectos-week-v1'
const EVT = 'projectos-week'
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || WEEK } catch { return WEEK }
}

export function useWeek() {
  const [week, setWeek] = useState(load)
  useEffect(() => {
    const f = () => setWeek(load())
    window.addEventListener(EVT, f)
    return () => window.removeEventListener(EVT, f)
  }, [])
  const update = (next) => {
    setWeek(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
    window.dispatchEvent(new Event(EVT))
  }
  return [week, update]
}

export const todayIdx = () => (new Date().getDay() + 6) % 7
// Evenings on weekdays, late morning at weekends.
export const sessionStart = (i) => (i >= 5 ? 10.5 : 20.5)
