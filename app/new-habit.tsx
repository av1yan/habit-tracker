import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { habits as habitsRepo } from '@backend/local'
import type { HabitFreqType, HabitType } from '@backend/data'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts, rgba } from '@/lib/theme'

const ICONS = ['🎯', '🏃', '🧘', '💧', '📚', '💪', '🥗', '☀️', '✍️', '😴', '🧠', '🚴']
const COLORS = ['#c67139', '#7a8a5e', '#4a90d9', '#c0504a', '#8a6a4a', '#7b5ea7']
const CATEGORIES = ['Health', 'Fitness', 'Wellness', 'Growth', 'Work', 'Personal']
const TYPES: { label: string; value: HabitType }[] = [
  { label: '✓ Done', value: 'binary' },
  { label: '# Count', value: 'quantity' },
  { label: '⏱ Time', value: 'duration' },
]
const FREQS: { label: string; freq_type: HabitFreqType; freq_target?: number; freq_days?: number[] }[] = [
  { label: 'Daily', freq_type: 'daily' },
  { label: 'Weekdays', freq_type: 'specific_days', freq_days: [1, 2, 3, 4, 5] },
  { label: '3× / week', freq_type: 'weekly_count', freq_target: 3 },
  { label: 'Weekly', freq_type: 'weekly_count', freq_target: 1 },
]

export default function NewHabit() {
  useTheme()
  const router = useRouter()
  const { local, refresh } = useApp()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [color, setColor] = useState(COLORS[0])
  const [category, setCategory] = useState('Health')
  const [type, setType] = useState<HabitType>('binary')
  const [target, setTarget] = useState('1')
  const [freqIdx, setFreqIdx] = useState(0)
  const [isBad, setIsBad] = useState(false)

  const save = async () => {
    if (!local || !name.trim()) return
    const freq = FREQS[freqIdx]
    await habitsRepo.createHabit(local, {
      name: name.trim(),
      icon,
      color,
      category,
      type,
      target: type === 'binary' ? null : Number(target) || 1,
      unit: type === 'duration' ? 'min' : type === 'quantity' ? 'x' : null,
      freq_type: freq.freq_type,
      freq_target: freq.freq_target ?? null,
      freq_days: freq.freq_days ?? null,
      is_bad: isBad,
    })
    refresh()
    router.back()
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontFamily: fonts.display, color: colors.ink }}>New Habit</Text>
        <View style={{ width: 50 }} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Morning Run"
        placeholderTextColor={colors.muted}
        style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '600', color: colors.ink }}
      />

      <Section title="ICON">
        <Wrap>
          {ICONS.map((ic) => (
            <Pressable
              key={ic}
              onPress={() => setIcon(ic)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: icon === ic ? rgba(color, 0.25) : colors.card,
                borderWidth: 2,
                borderColor: icon === ic ? color : 'transparent',
              }}
            >
              <Text style={{ fontSize: 22 }}>{ic}</Text>
            </Pressable>
          ))}
        </Wrap>
      </Section>

      <Section title="COLOR">
        <Wrap>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: c,
                borderWidth: 3,
                borderColor: color === c ? colors.ink : 'transparent',
              }}
            />
          ))}
        </Wrap>
      </Section>

      <Section title="FREQUENCY">
        <Wrap>
          {FREQS.map((f, i) => (
            <Pill key={f.label} label={f.label} active={freqIdx === i} color={color} onPress={() => setFreqIdx(i)} />
          ))}
        </Wrap>
      </Section>

      <Section title="TYPE">
        <Wrap>
          {TYPES.map((t) => (
            <Pill key={t.value} label={t.label} active={type === t.value} color={color} onPress={() => setType(t.value)} />
          ))}
        </Wrap>
        {type !== 'binary' && (
          <TextInput
            value={target}
            onChangeText={setTarget}
            keyboardType="number-pad"
            placeholder="Target (e.g. 8)"
            placeholderTextColor={colors.muted}
            style={{ marginTop: 10, backgroundColor: colors.card, borderRadius: 12, padding: 12, fontSize: 15, color: colors.ink }}
          />
        )}
      </Section>

      <Section title="CATEGORY">
        <Wrap>
          {CATEGORIES.map((c) => (
            <Pill key={c} label={c} active={category === c} color={color} onPress={() => setCategory(c)} />
          ))}
        </Wrap>
      </Section>

      <Section title="I WANT TO…">
        <Wrap>
          <Pill label="✅ Build" active={!isBad} color={colors.green} onPress={() => setIsBad(false)} />
          <Pill label="🚫 Quit" active={isBad} color={colors.danger} onPress={() => setIsBad(true)} />
        </Wrap>
      </Section>

      <Pressable
        onPress={save}
        disabled={!name.trim()}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 999,
          padding: 16,
          alignItems: 'center',
          opacity: name.trim() ? 1 : 0.5,
          marginTop: 4,
        }}
      >
        <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>Add Habit</Text>
      </Pressable>
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1, color: colors.muted }}>{title}</Text>
      {children}
    </View>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}

function Pill({
  label,
  active,
  color,
  onPress,
}: {
  label: string
  active: boolean
  color: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? rgba(color, 0.2) : colors.card,
        borderWidth: 1.5,
        borderColor: active ? color : 'transparent',
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: fonts.semibold, color: active ? color : colors.sub }}>{label}</Text>
    </Pressable>
  )
}
