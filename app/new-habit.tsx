import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { habits as habitsRepo } from '@backend/local'
import type { HabitFreqType, HabitType } from '@backend/data'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { track } from '@/lib/analytics'
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
  const insets = useSafeAreaInsets()
  const { local, refresh } = useApp()

  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [color, setColor] = useState(COLORS[0])
  const [category, setCategory] = useState('Health')
  const [type, setType] = useState<HabitType>('binary')
  const [target, setTarget] = useState('1')
  const [freqIdx, setFreqIdx] = useState(0)
  const [isBad, setIsBad] = useState(false)

  const next = () => setStep((s) => Math.min(3, s + 1))
  const prev = () => setStep((s) => Math.max(1, s - 1))

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
    void track('habit_created', { type, freq_type: freq.freq_type, is_bad: isBad })
    refresh()
    router.back()
  }

  const typeLabel = TYPES.find((t) => t.value === type)?.label ?? ''

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Pressable
          onPress={() => (step === 1 ? router.back() : prev())}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? 'Cancel' : 'Back'}
        >
          <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 14 }}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontFamily: fonts.display, color: colors.ink }}>New Habit</Text>
        <Text style={{ fontSize: 12, color: colors.muted, width: 40, textAlign: 'right' }}>{step}/3</Text>
      </View>

      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: colors.line }}>
        <View style={{ height: 3, width: `${(step / 3) * 100}%`, backgroundColor: colors.accent }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Heading>{'What habit do you\nwant to build?'}</Heading>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Morning Run"
              placeholderTextColor={colors.muted}
              autoFocus
              accessibilityLabel="Habit name"
              style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '600', color: colors.ink }}
            />

            <Section title="ICON">
              <Wrap>
                {ICONS.map((ic) => (
                  <Pressable
                    key={ic}
                    onPress={() => setIcon(ic)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: icon === ic }}
                    accessibilityLabel={`Icon ${ic}`}
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
                {COLORS.map((c, i) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: color === c }}
                    accessibilityLabel={`Color ${i + 1}`}
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

            <PrimaryButton label="Continue →" onPress={next} disabled={!name.trim()} />
          </>
        )}

        {step === 2 && (
          <>
            <Heading>{'How often will\nyou do it?'}</Heading>

            <Section title="FREQUENCY">
              <View style={{ gap: 8 }}>
                {FREQS.map((f, i) => (
                  <OptionRow key={f.label} label={f.label} active={freqIdx === i} color={color} onPress={() => setFreqIdx(i)} />
                ))}
              </View>
            </Section>

            <Section title="HABIT TYPE">
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
                  placeholder={type === 'duration' ? 'Target minutes (e.g. 20)' : 'Target count (e.g. 8)'}
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Target"
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={prev}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={{ flex: 1, borderWidth: 2, borderColor: colors.accent, borderRadius: 999, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 14 }}>← Back</Text>
              </Pressable>
              <Pressable
                onPress={next}
                accessibilityRole="button"
                accessibilityLabel="Continue"
                style={{ flex: 2, backgroundColor: colors.btn, borderRadius: 999, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 14 }}>Continue →</Text>
              </Pressable>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Heading>Looking good! 🎉</Heading>

            {/* Preview card */}
            <View
              accessible
              accessibilityLabel={`Preview: ${name.trim() || 'New habit'}, ${category}, ${FREQS[freqIdx].label}, ${typeLabel}`}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 20,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: rgba(color, 0.15),
                }}
              >
                <Text style={{ fontSize: 28 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: fonts.semibold, color: colors.ink }}>
                  {name.trim() || 'New habit'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                  {category} · {FREQS[freqIdx].label}
                </Text>
                <View
                  style={{
                    marginTop: 8,
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    backgroundColor: rgba(color, 0.15),
                  }}
                >
                  <Text style={{ fontSize: 11, fontFamily: fonts.semibold, color }}>{typeLabel}</Text>
                </View>
              </View>
            </View>

            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>
                This habit is something I want to…
              </Text>
              <Wrap>
                <Pill label="✅ Build" active={!isBad} color={colors.green} onPress={() => setIsBad(false)} />
                <Pill label="🚫 Quit" active={isBad} color={colors.danger} onPress={() => setIsBad(true)} />
              </Wrap>
            </View>

            <PrimaryButton label="Add Habit" onPress={save} disabled={!name.trim()} />
            <Pressable onPress={prev} accessibilityRole="button" accessibilityLabel="Go back" style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>← Go back</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink }}>
      {children}
    </Text>
  )
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        backgroundColor: colors.btn,
        borderRadius: 999,
        padding: 16,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
        marginTop: 4,
      }}
    >
      <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>{label}</Text>
    </Pressable>
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

function OptionRow({
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
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: active ? rgba(color, 0.15) : colors.card,
        borderWidth: 1.5,
        borderColor: active ? color : 'transparent',
      }}
    >
      <Text style={{ fontSize: 15, fontFamily: fonts.semibold, color: active ? color : colors.ink }}>{label}</Text>
      {active && <Text style={{ color, fontSize: 15, fontWeight: '900' }}>✓</Text>}
    </Pressable>
  )
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
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
