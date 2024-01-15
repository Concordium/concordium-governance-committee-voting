import { clsx } from 'clsx';
import { forwardRef, InputHTMLAttributes, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';

export interface FileInputRef {
    reset(): void;
}

export type FileInputValue = FileList | null;

export interface FileInputProps
    extends Pick<
        InputHTMLAttributes<HTMLInputElement>,
        'accept' | 'multiple' | 'placeholder' | 'disabled' | 'className'
    > {
    value: FileInputValue;
    error?: string;
    name?: string;
    buttonTitle: string;
    onChange(files: FileInputValue): void;
    disableFileNames?: boolean;
}

/**
 * @description
 * Component for handling file input. Parsing of file should be done externally. Supports drag and drop + click to browse.
 *
 * @example
 * <FileInput value={files} onChange={setFiles} />
 */
const FileInput = forwardRef<FileInputRef, FileInputProps>(
    (
        { value, onChange, error, placeholder, className, buttonTitle, disableFileNames = false, ...inputProps },
        ref,
    ): JSX.Element => {
        const inputRef = useRef<HTMLInputElement>(null);
        const [dragOver, setDragOver] = useState<boolean>(false);
        const files = useMemo(() => new Array(value?.length ?? 0).fill(0).map((_, i) => value?.item(i)), [value]);
        const isInvalid = error !== undefined;

        const { disabled } = inputProps;

        useImperativeHandle(ref, () => ({
            reset: () => {
                if (inputRef.current) {
                    inputRef.current.value = '';
                }
            },
        }));

        return (
            <label
                className={clsx(
                    'file-input',
                    isInvalid && 'file-input--invalid',
                    disabled && 'file-input--disabled',
                    dragOver && 'file-input--hovering',
                    className,
                )}
                onDragOver={() => setDragOver(true)}
                onDragLeave={() => setDragOver(false)}
            >
                <div className="file-input__wrapper">
                    {files.length === 0 || disableFileNames
                        ? placeholder && <div className="file-input__empty">{placeholder}</div>
                        : files.map((f, i) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <div key={i} className="file-input__fileName">
                                {f?.name}
                            </div>
                        ))}
                    <Button className="file-input__button" disabled={disabled} variant="secondary">
                        {buttonTitle}
                    </Button>
                    <input
                        className="file-input__input"
                        type="file"
                        onChange={(e) => {
                            console.log(e);
                            onChange(e.target.files);
                        }}
                        ref={inputRef}
                        {...inputProps}
                    />
                </div>
                <div className="file-input__error">{error}</div>
            </label>
        );
    },
);

FileInput.displayName = 'FileInput';

export default FileInput;
