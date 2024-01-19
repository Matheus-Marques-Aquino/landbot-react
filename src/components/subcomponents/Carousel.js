import React, { useEffect, useRef, useState } from 'react';

import { FaCircleChevronLeft } from "react-icons/fa6";
import { FaCircleChevronRight } from "react-icons/fa6";

import { FaAngleLeft } from "react-icons/fa6";
import { FaAngleRight } from "react-icons/fa6";

import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from 'swiper/modules';

import "swiper/css";

import 'swiper/css/pagination';

import PlanCard from '../widgets/PlanCard';

export default function Carousel({ planList }) {
    var cardArray = [ 1, 2, 3, 4, 6 ];
    cardArray = cardArray.reverse();

    const [containerWidth, setContainerWidth] = useState(0);

    const swiperRef = useRef();
    const containerRef = useRef();

    //if (swiperRef.current) {
    //    console.log('Width:', containerRef.current.offsetWidth);
    //}


    useEffect(() => {
        const updateContainerWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);

                console.log('Width:', containerRef.current.offsetWidth);
            }
        }

        updateContainerWidth();

        window.addEventListener('resize', updateContainerWidth);

        return () => {
            window.removeEventListener('resize', updateContainerWidth);
        };
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            console.log('Width:', containerRef.current.offsetWidth);
            setContainerWidth(containerRef.current.offsetWidth);
        }
    }, [containerRef.current]);

    return (
        <div 
            className="w-full relative"
            ref={containerRef}
        >
            <Swiper
                className="cursor-grab"
                ref={swiperRef}
                slidesPerView={1}
                centeredSlides={true}
                effect="slide"
                speed={1000}
                initialSlide={1} 
                pagination={true}
                modules={[Pagination]}
            >
                {
                    planList.map((card, index)=>{     
                        return (
                            <SwiperSlide key={index}>
                                <div className='mb-[30px]'>
                                    <PlanCard plan_id={card.plan_id} name={card.name} price={card.price} is={card.is} coverages={card.coverages} />
                                </div>
                            </SwiperSlide>
                        )
                    })
                }
            </Swiper> 
            <div 
                className="w-[27px] h-[27px] bg-[#03a8db] rounded-full rounded-full flex opacity-90 absolute left-[5px] top-0 bottom-0 my-auto z-[200]"
                onClick={() => swiperRef.current.swiper.slidePrev()}
            >
                <FaAngleLeft className="m-auto text-white w-[16px] h-[16px] pr-[2px] opacity-100 cursor-pointer"/>
            </div>         
            <div 
                className="w-[26px] h-[26px] bg-[#03a8db] rounded-full rounded-full flex opacity-90 absolute right-[5px] top-0 bottom-0 my-auto z-[200]"
                onClick={() => swiperRef.current.swiper.slideNext()}
            >
                <FaAngleRight className="m-auto text-white w-[16px] h-[16px] pl-[2px] opacity-100 cursor-pointer"/>
            </div> 
        </div>

    )
}