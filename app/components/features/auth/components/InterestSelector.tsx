interface InterestSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
}

export function InterestSelector({ value, onChange, options }: InterestSelectorProps) {
  const toggleInterest = (interest: string) => {
    if (value.includes(interest)) {
      onChange(value.filter((i) => i !== interest));
    } else {
      if (value.length < 10) {
        onChange([...value, interest]);
      }
    }
  };

  return (
    <div className='flex flex-wrap gap-2'>
      {options.map((option) => {
        const isSelected = value.includes(option);
        return (
          <button
            key={option}
            type='button'
            onClick={() => toggleInterest(option)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isSelected
                ? 'bg-primary-main text-primary-text'
                : 'bg-secondary-main text-secondary-text hover:bg-primary-main hover:text-white'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
