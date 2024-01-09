import React, { useEffect, useRef, useState } from 'react';
import { FaInfo } from "react-icons/fa6";

export default function Tooltip ({ text }) {
    const [showTooltip, setShowTooltip] = useState(false);

    const tooltipHandler = (display) => {
        setShowTooltip(display);
    };

    return(
        <span
            className={`bg-[#000000] rounded-full text-[#ffffff] items-center justify-center text-[7px] p-[2px] w-fit h-fit text-[7px] mt-[2px] mr-[auto] mb-[auto] ml-[3px] flex cursor-pointer relative ${text ? '' : 'hidden'}`}
            onMouseEnter={()=>{ tooltipHandler(true) }}
            onMouseLeave={()=>{ tooltipHandler(false) }}
        >
            <FaInfo className="m-auto opacity-[0.7]" />
            <div
                className={`absolute bg-[#000000]/[0.6] rounded-[5px] text-[#ffffff] text-[12px] font-normal py-[5px] px-[10px] w-[max-content] h-[fit-content] cursor-pointer absolute z-[150] left-[100%] ml-[5px] max-w-[200px] ${showTooltip ? '' : 'hidden'}`}
            >
                {text}
            </div>
        </span>
    )
}
