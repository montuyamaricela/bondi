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
                ? 'bg-purple-600 text-white dark:bg-purple-500'
                : 'bg-gray-100 text-gray-700 hover:bg-secondary-main dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
